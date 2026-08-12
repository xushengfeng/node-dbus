import type { USocket } from "myde-unix-socket";
import type net from "net";
import { dbusMessage } from "./message";
import { MessageType } from "./types";

import { authenticate } from "./auth";

/** 可用于 D-Bus 连接的 socket 类型 */
export type SocketLike = USocket | net.Socket;

/**
 * D-Bus I/O 管理器，负责消息的发送、接收和路由
 * 管理与 D-Bus 守护进程的连接，处理请求-响应匹配
 */
export class dbusIO {
	private socket: SocketLike;
	private serial = 0;
	private pendingCalls: Map<
		number,
		{ resolve: (msg: dbusMessage) => void; reject: (err: Error) => void }
	> = new Map();
	private buffer: Uint8Array = new Uint8Array(0);
	private messageHandlers: Set<(msg: dbusMessage) => void> = new Set();
	private isConnected = false;

	/**
	 * 创建 D-Bus I/O 管理器
	 * @param op - 配置选项，包含 socket 连接
	 */
	constructor(op: { socket: SocketLike }) {
		this.socket = op.socket;
		// Don't setup read handler until authenticated
	}

	/**
	 * 连接到 D-Bus 守护进程
	 * 进行认证并自动调用 Hello 注册总线名
	 */
	async connect(): Promise<void> {
		if (this.isConnected) return;
		await authenticate(this.socket);
		this.setupReadHandler();
		this.isConnected = true;

		// Automatically call Hello to register with the bus
		const helloMsg = new dbusMessage();
		helloMsg.setDestination("org.freedesktop.DBus");
		helloMsg.setPath("/org/freedesktop/DBus");
		helloMsg.setInterface("org.freedesktop.DBus");
		helloMsg.setMember("Hello");
		await this.call(helloMsg);
	}

	/**
	 * 添加消息处理器
	 * @param handler - 消息处理回调函数
	 */
	addMessageHandler(handler: (msg: dbusMessage) => void): void {
		this.messageHandlers.add(handler);
	}

	/**
	 * 移除消息处理器
	 * @param handler - 要移除的处理回调函数
	 */
	removeMessageHandler(handler: (msg: dbusMessage) => void): void {
		this.messageHandlers.delete(handler);
	}

	private nextSerial(): number {
		return ++this.serial;
	}

	private setupReadHandler(): void {
		this.socket.on("data", (data) => {
			const newData = new Uint8Array(data);
			const combined = new Uint8Array(this.buffer.length + newData.length);
			combined.set(this.buffer);
			combined.set(newData, this.buffer.length);
			this.buffer = combined;
			this.processBuffer();
		});
	}

	private processBuffer(): void {
		while (this.buffer.length >= 16) {
			// 尝试解码，如果失败则等待更多数据
			try {
				const result = dbusMessage.decode(this.buffer);
				this.handleMessage(result.message);

				// 解码成功，移除消耗的字节
				this.buffer = this.buffer.slice(result.consumed);
			} catch (e) {
				// 解码失败，可能需要更多数据
				break;
			}
		}
	}

	private handleMessage(msg: dbusMessage): void {
		const replySerial = msg.getReplySerial();
		if (replySerial !== undefined) {
			const pending = this.pendingCalls.get(replySerial);
			if (pending) {
				this.pendingCalls.delete(replySerial);
				if (msg.getType() === MessageType.Error) {
					const errorName = msg.getErrorName() || "UnknownError";
					const errorText = msg.getBody()[0] || "";
					pending.reject(new Error(`[${errorName}] ${errorText}`));
				} else {
					pending.resolve(msg);
				}
			}
		}

		for (const handler of this.messageHandlers) {
			handler(msg);
		}
	}

	/**
	 * 发送方法调用并等待响应
	 * @param message - 要发送的 D-Bus 消息
	 * @returns 响应消息
	 */
	async call(message: dbusMessage): Promise<dbusMessage> {
		if (!this.isConnected) {
			throw new Error(
				"dbusIO is not connected/authenticated. Call connect() first.",
			);
		}
		message.setType(MessageType.MethodCall);
		const serial = this.nextSerial();
		message.setSerial(serial);

		return new Promise((resolve, reject) => {
			this.pendingCalls.set(serial, { resolve, reject });

			const data = message.encode();
			this.socket.write(Buffer.from(data));

			setTimeout(() => {
				if (this.pendingCalls.has(serial)) {
					this.pendingCalls.delete(serial);
					reject(new Error("Call timeout"));
				}
			}, 10000);
		});
	}

	/**
	 * 发送消息（不等待响应）
	 * @param message - 要发送的 D-Bus 消息
	 */
	async send(message: dbusMessage): Promise<void> {
		if (!this.isConnected) {
			throw new Error(
				"dbusIO is not connected/authenticated. Call connect() first.",
			);
		}
		if (!message.getSerial()) {
			message.setSerial(this.nextSerial());
		}
		const data = message.encode();
		this.socket.write(Buffer.from(data));
	}

	/**
	 * 发送信号消息
	 * @param message - 要发送的 D-Bus 消息（自动设置为 Signal 类型）
	 */
	async emit(message: dbusMessage): Promise<void> {
		message.setType(MessageType.Signal);
		return this.send(message);
	}
}

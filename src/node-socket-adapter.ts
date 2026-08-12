import { Duplex } from "stream";
import type net from "net";

/** NodeSocketAdapter 事件类型映射 */
export interface NodeSocketAdapterEvents {
	/** 收到数据 */
	data: (data: Buffer, fds: number[]) => void;
	/** 连接建立 */
	connect: () => void;
	/** 连接结束 */
	end: () => void;
	/** 连接关闭 */
	close: () => void;
	/** 发生错误 */
	error: (err: Error) => void;
	/** 缓冲区可写 */
	drain: () => void;
	/** 写入完成 */
	finish: () => void;
}

/**
 * 将 Node.js net.Socket 适配为 USocket 兼容的 Duplex 流
 * 用于 D-Bus 连接的 socket 适配
 */
export class NodeSocketAdapter extends Duplex {
	/** 文件描述符 */
	fd?: number;
	private _socket: net.Socket;
	private _destroyed: boolean = false;

	/**
	 * 创建 socket 适配器
	 * @param socket - 要适配的 Node.js net.Socket
	 */
	constructor(socket: net.Socket) {
		super();
		this._socket = socket;
		this._setupListeners();
	}

	private _setupListeners(): void {
		this._socket.on("data", (data: Buffer) => {
			this.emit("data", data, []);
		});

		this._socket.on("connect", () => {
			this.emit("connect");
		});

		this._socket.on("end", () => {
			this.emit("end");
		});

		this._socket.on("close", () => {
			this.emit("close");
		});

		this._socket.on("error", (err: Error) => {
			this.emit("error", err);
		});

		this._socket.on("drain", () => {
			this.emit("drain");
		});
	}

	on<K extends keyof NodeSocketAdapterEvents>(
		event: K,
		listener: NodeSocketAdapterEvents[K],
	): this;
	on(event: string, listener: (...args: any[]) => void): this;
	on(event: string | symbol, listener: (...args: any[]) => void): this {
		return super.on(event, listener);
	}

	once<K extends keyof NodeSocketAdapterEvents>(
		event: K,
		listener: NodeSocketAdapterEvents[K],
	): this;
	once(event: string, listener: (...args: any[]) => void): this;
	once(event: string | symbol, listener: (...args: any[]) => void): this {
		return super.once(event, listener);
	}

	emit<K extends keyof NodeSocketAdapterEvents>(
		event: K,
		...args: Parameters<NodeSocketAdapterEvents[K]>
	): boolean;
	emit(event: string | symbol, ...args: any[]): boolean {
		return super.emit(event, ...args);
	}

	/**
	 * 连接到指定路径的 Unix socket
	 * @param path - socket 文件路径
	 * @param cb - 连接成功回调
	 */
	connect(path: string, cb?: () => void): void {
		this._socket.connect(path, cb);
	}

	_read(_size: number): void {
		// 数据由底层socket处理
	}

	_write(
		chunk: any,
		encoding: BufferEncoding,
		callback: (error?: Error | null) => void,
	): void {
		this._socket.write(chunk, encoding, callback);
	}

	end(): this;
	end(cb: () => void): this;
	end(chunk: any, cb?: () => void): this;
	end(chunk: any, encoding?: BufferEncoding, cb?: () => void): this;
	end(...args: any[]): this {
		// @ts-ignore
		return super.end(...args);
	}

	/**
	 * 销毁连接
	 * @param error - 可选的错误对象
	 */
	destroy(error?: Error): this {
		if (this._destroyed) {
			return this;
		}
		this._destroyed = true;
		this._socket.destroy(error);
		return this;
	}
}

/**
 * 创建 NodeSocketAdapter 实例
 * @param socket - Node.js net.Socket
 * @returns NodeSocketAdapter 实例
 */
export function createNodeSocketAdapter(socket: net.Socket): NodeSocketAdapter {
	return new NodeSocketAdapter(socket);
}

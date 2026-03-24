import type { USocket } from "myde-unix-socket";
import { dbusMessage } from "./message";
import { MessageType } from "./types";

export class dbusIO {
    private socket: USocket;
    private serial = 0;
    private pendingCalls: Map<number, { resolve: (msg: dbusMessage) => void; reject: (err: Error) => void }> =
        new Map();
    private buffer: Uint8Array = new Uint8Array(0);
    private messageHandlers: Set<(msg: dbusMessage) => void> = new Set();

    constructor(op: { socket: USocket }) {
        this.socket = op.socket;
        this.setupReadHandler();
    }

    addMessageHandler(handler: (msg: dbusMessage) => void): void {
        this.messageHandlers.add(handler);
    }

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

    async call(message: dbusMessage): Promise<dbusMessage> {
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

    async send(message: dbusMessage): Promise<void> {
        if (!message.getSerial()) {
            message.setSerial(this.nextSerial());
        }
        const data = message.encode();
        this.socket.write(Buffer.from(data));
    }

    async emit(message: dbusMessage): Promise<void> {
        message.setType(MessageType.Signal);
        return this.send(message);
    }
}

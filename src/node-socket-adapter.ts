import { Duplex } from "stream";
import type net from "net";

export interface NodeSocketAdapterEvents {
	data: (data: Buffer, fds: number[]) => void;
	connect: () => void;
	end: () => void;
	close: () => void;
	error: (err: Error) => void;
	drain: () => void;
	finish: () => void;
}

export class NodeSocketAdapter extends Duplex {
	fd?: number;
	private _socket: net.Socket;
	private _destroyed: boolean = false;

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

	destroy(error?: Error): this {
		if (this._destroyed) {
			return this;
		}
		this._destroyed = true;
		this._socket.destroy(error);
		return this;
	}
}

export function createNodeSocketAdapter(socket: net.Socket): NodeSocketAdapter {
	return new NodeSocketAdapter(socket);
}

import { dbusClient, type dbusInterface } from "./client";
import type { dbusIO } from "./dbus";
import type { DBusTypes } from "./dbus_type";
import { dbusMessage } from "./message";
import { MessageType } from "./types";

type MayPromise<T> = Promise<T> | T;
export type ServerMethodHandler = (...args: any[]) => MayPromise<
	| {
			signature: string;
			value: any;
	  }
	| undefined
>;

export function serverReturn<T extends string>(
	signature: T,
	// @ts-expect-error
	...args: DBusTypes<T>
) {
	return { signature, value: args };
}

export class dbusServer {
	private io: dbusIO;
	private name: string;
	private iface: dbusInterface | null = null;
	private handlers: Map<string, Map<string, Map<string, ServerMethodHandler>>> =
		new Map();

	constructor(io: dbusIO, name: string) {
		this.io = io;
		this.name = name;
	}

	async init(): Promise<void> {
		const client = new dbusClient({ io: this.io });
		const service = await client.getService("org.freedesktop.DBus");
		const obj = await service.getObject("/org/freedesktop/DBus");
		this.iface = await obj.getInterface("org.freedesktop.DBus");
		await this.iface.call("RequestName", "su", this.name, 0).await();

		this.io.addMessageHandler(this.handleMessage.bind(this));
	}

	addObject(
		path: string,
		iface: string,
		methods: Record<string, ServerMethodHandler>,
	): void {
		if (!this.handlers.has(path)) {
			this.handlers.set(path, new Map());
		}
		const pathHandlers = this.handlers.get(path)!;
		pathHandlers.set(iface, new Map(Object.entries(methods)));
	}

	getHandler(
		path: string,
		iface: string,
		method: string,
	): ServerMethodHandler | undefined {
		return this.handlers.get(path)?.get(iface)?.get(method);
	}

	removeObject(path: string, iface?: string): void {
		if (!iface) {
			this.handlers.delete(path);
		} else {
			this.handlers.get(path)?.delete(iface);
		}
	}

	async emitSignal(
		path: string,
		iface: string,
		name: string,
		signature: string = "",
		args: unknown[] = [],
	): Promise<void> {
		const msg = new dbusMessage();
		msg.setType(MessageType.Signal);
		msg.setPath(path);
		msg.setInterface(iface);
		msg.setMember(name);
		if (signature) {
			msg.setSignature(signature);
			msg.setBody(args);
		}
		await this.io.send(msg);
	}

	private async handleMessage(msg: dbusMessage): Promise<void> {
		if (msg.getType() !== MessageType.MethodCall) return;

		// Ensure message has a destination, or it's a broadcast? Usually method calls must have destination.
		// Wait, sometimes a method call is just sent to the connection without destination if point-to-point,
		// but here it's typically sent to our `name`.
		// D-Bus daemon handles routing. We just need to check path, iface, and member.

		const path = msg.getPath();
		const iface = msg.getInterface();
		const member = msg.getMember();
		const sender = msg.getSender();

		if (!path || !member || !sender) return;

		// If no interface is specified, D-Bus allows searching through interfaces, but it's ambiguous.
		// For simplicity, we require the exact match if iface is provided, or search if not provided.
		let handler: ServerMethodHandler | undefined;

		if (iface) {
			handler = this.handlers.get(path)?.get(iface)?.get(member);
		} else {
			const pathHandlers = this.handlers.get(path);
			if (pathHandlers) {
				for (const ifaceMap of pathHandlers.values()) {
					if (ifaceMap.has(member)) {
						if (handler) {
							// Ambiguous
							handler = undefined;
							break;
						}
						handler = ifaceMap.get(member);
					}
				}
			}
		}

		if (!handler) {
			const err = new dbusMessage();
			err.setType(MessageType.Error);
			err.setErrorName("org.freedesktop.DBus.Error.UnknownMethod");
			err.setReplySerial(msg.getSerial());
			err.setDestination(sender);
			err.setSignature("s");
			err.setBody([`Method ${member} on path ${path} doesn't exist`]);
			await this.io.send(err);
			return;
		}

		try {
			const args = msg.getBody() || [];
			const result = await handler(...args);

			const reply = new dbusMessage();
			reply.setType(MessageType.MethodReturn);
			reply.setReplySerial(msg.getSerial());
			reply.setDestination(sender);

			if (result !== undefined) {
				reply.setSignature(result.signature);
				reply.setBody(result.value);
			}

			await this.io.send(reply);
		} catch (e: any) {
			const err = new dbusMessage();
			err.setType(MessageType.Error);
			err.setErrorName(e.name || "org.freedesktop.DBus.Error.Failed");
			err.setReplySerial(msg.getSerial());
			err.setDestination(sender);
			err.setSignature("s");
			err.setBody([e.message || String(e)]);
			await this.io.send(err);
		}
	}
}

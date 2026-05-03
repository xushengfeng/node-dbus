import type { dbusIO } from "./dbus";
import { dbusMessage } from "./message";
import { MessageType } from "./types";

type dbusClientOp = {
	io: dbusIO;
	destination: string;
	path: string;
	interface: string;
};

export class dbusClient {
	op: Omit<dbusClientOp, "destination" | "path" | "interface">;
	constructor(op: typeof dbusClient.prototype.op) {
		this.op = { ...op };
	}
	async getService(name: string) {
		return new dbusService({ ...this.op, destination: name });
	}
}

export class dbusService {
	op: Omit<dbusClientOp, "path" | "interface">;
	constructor(op: typeof dbusService.prototype.op) {
		this.op = { ...op };
	}
	async getObject(path: string) {
		return new dbusObject({ ...this.op, path });
	}
}

export class dbusObject {
	op: Omit<dbusClientOp, "interface">;
	constructor(op: typeof dbusObject.prototype.op) {
		this.op = { ...op };
	}
	async getInterface(name: string) {
		return new dbusInterface({ ...this.op, interface: name });
	}
}

export class dbusInterface {
	op: dbusClientOp;
	io: dbusIO;
	constructor(op: dbusClientOp) {
		this.op = { ...op };
		this.io = op.io;
	}

	async call(
		method: string,
		signature: string = "",
		...args: unknown[]
	): Promise<dbusMessage> {
		const msg = new dbusMessage();
		msg.setDestination(this.op.destination);
		msg.setPath(this.op.path);
		msg.setInterface(this.op.interface);
		msg.setMember(method);
		if (signature) {
			msg.setSignature(signature);
			msg.setBody(args);
		}
		return this.io.call(msg);
	}

	async get(property: string): Promise<unknown> {
		const msg = new dbusMessage();
		msg.setDestination(this.op.destination);
		msg.setPath(this.op.path);
		msg.setInterface("org.freedesktop.DBus.Properties");
		msg.setMember("Get");
		msg.setSignature("ss");
		msg.setBody([this.op.interface, property]);

		const response = await this.io.call(msg);
		return response.getBody()[0];
	}

	async set(
		property: string,
		value: unknown,
		signature: string,
	): Promise<void> {
		const msg = new dbusMessage();
		msg.setDestination(this.op.destination);
		msg.setPath(this.op.path);
		msg.setInterface("org.freedesktop.DBus.Properties");
		msg.setMember("Set");
		msg.setSignature("ssv");
		msg.setBody([this.op.interface, property, { signature, value }]);
		await this.io.call(msg);
	}

	async getAll(): Promise<Record<string, unknown>> {
		const msg = new dbusMessage();
		msg.setDestination(this.op.destination);
		msg.setPath(this.op.path);
		msg.setInterface("org.freedesktop.DBus.Properties");
		msg.setMember("GetAll");
		msg.setSignature("s");
		msg.setBody([this.op.interface]);
		const response = await this.io.call(msg);
		return response.getBody()[0] as Record<string, unknown>;
	}

	async on(
		signal: string,
		// biome-ignore lint/suspicious/noExplicitAny: cb
		callback: (...args: any[]) => void,
	): Promise<() => void> {
		const rule = `type='signal',sender='${this.op.destination}',interface='${this.op.interface}',member='${signal}',path='${this.op.path}'`;

		const msg = new dbusMessage();
		msg.setDestination("org.freedesktop.DBus");
		msg.setPath("/org/freedesktop/DBus");
		msg.setInterface("org.freedesktop.DBus");
		msg.setMember("AddMatch");
		msg.setSignature("s");
		msg.setBody([rule]);

		await this.io.call(msg);

		const handler = (m: dbusMessage) => {
			if (
				m.getType() === MessageType.Signal &&
				m.getPath() === this.op.path &&
				m.getInterface() === this.op.interface &&
				m.getMember() === signal
			) {
				callback(...m.getBody());
			}
		};

		this.io.addMessageHandler(handler);

		return async () => {
			this.io.removeMessageHandler(handler);
			const removeMsg = new dbusMessage();
			removeMsg.setDestination("org.freedesktop.DBus");
			removeMsg.setPath("/org/freedesktop/DBus");
			removeMsg.setInterface("org.freedesktop.DBus");
			removeMsg.setMember("RemoveMatch");
			removeMsg.setSignature("s");
			removeMsg.setBody([rule]);
			await this.io.call(removeMsg);
		};
	}
}

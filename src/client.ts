import type { dbusIO } from "./dbus";
import type { DBusTypes } from "./dbus_type";
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
	private introspectable: dbusInterfaceRaw;
	private peer: dbusInterfaceRaw;
	private properties: dbusInterfaceRaw;
	constructor(op: typeof dbusObject.prototype.op) {
		this.op = { ...op };
		this.introspectable = new dbusInterfaceRaw({
			...this.op,
			interface: "org.freedesktop.DBus.Introspectable",
		});
		this.peer = new dbusInterfaceRaw({
			...this.op,
			interface: "org.freedesktop.DBus.Peer",
		});
		this.properties = new dbusInterfaceRaw({
			...this.op,
			interface: "org.freedesktop.DBus.Properties",
		});
	}
	async getInterface(name: string) {
		return new dbusInterface(
			{ ...this.op, interface: name },
			{
				introspectable: this.introspectable,
				peer: this.peer,
				properties: this.properties,
			},
		);
	}
}

export class dbusInterfaceRaw {
	op: dbusClientOp;
	io: dbusIO;
	constructor(op: dbusClientOp) {
		this.op = { ...op };
		this.io = op.io;
	}
	call<T extends string = "">(
		method: string,
		signature: T = "" as T,
		// @ts-expect-error
		...args: DBusTypes<T>
	) {
		const msg = new dbusMessage();
		msg.setDestination(this.op.destination);
		msg.setPath(this.op.path);
		msg.setInterface(this.op.interface);
		msg.setMember(method);
		if (signature) {
			msg.setSignature(signature);
			// @ts-expect-error
			msg.setBody(args);
		}
		const r = this.io.call(msg);

		return {
			async await() {
				await r;
			},
			async as<R extends string>(): Promise<DBusTypes<R>> {
				const response = await r;
				const body = response.getBody();
				return body as DBusTypes<R>;
			},
		};
	}
}

export class dbusInterface {
	op: dbusClientOp;
	io: dbusIO;
	private meta: {
		introspectable: dbusInterfaceRaw;
		peer: dbusInterfaceRaw;
		properties: dbusInterfaceRaw;
	};
	private m: dbusInterfaceRaw;
	constructor(
		op: dbusClientOp,
		meta: {
			introspectable: dbusInterfaceRaw;
			peer: dbusInterfaceRaw;
			properties: dbusInterfaceRaw;
		},
	) {
		this.op = { ...op };
		this.io = op.io;
		this.meta = meta;
		this.m = new dbusInterfaceRaw(this.op);
	}

	call<T extends string = "">(
		method: string,
		signature: T = "" as T,
		// @ts-expect-error
		...args: DBusTypes<T>
	) {
		// @ts-expect-error
		return this.m.call(method, signature, ...args);
	}

	async get<T extends string>(property: string): Promise<DBusTypes<T>> {
		return await this.meta.properties
			.call("Get", "ss", this.op.interface, property)
			.as<T>();
	}

	async set<T extends string>(
		property: string,
		value: DBusTypes<T>,
		signature: T,
	): Promise<void> {
		await this.meta.properties
			.call("Set", "ssv", this.op.interface, property, { signature, value })
			.await();
	}

	async getAll(): Promise<Record<string, unknown>> {
		const b = await this.meta.properties
			.call("GetAll", "s", this.op.interface)
			.as<"a{sv}">();
		const result: Record<string, unknown> = {};
		for (const [k, v] of b[0]) {
			result[k] = v;
		}
		return result;
	}

	async on<T extends string>(
		signal: string,
		// @ts-expect-error
		callback: (...args: DBusTypes<T>) => void,
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
				// @ts-expect-error
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

	async propertiesChanged(
		callback: (
			changedProperties: Record<string, unknown>,
			invalidatedProperties: string[],
		) => void,
	): Promise<() => void> {
		const propertiesIface = new dbusInterface(
			{ ...this.op, interface: this.meta.properties.op.interface },
			this.meta,
		);
		// todo 合并到object
		return propertiesIface.on<"sa{sv}as">(
			"PropertiesChanged",
			(interfaceName, changedProperties, invalidatedProperties) => {
				if (interfaceName !== this.op.interface) return;
				callback(
					Object.fromEntries(changedProperties.map(([k, v]) => [k, v.value])),
					invalidatedProperties,
				);
			},
		);
	}
}

export class dbusMetaInterface {
	private iface: dbusInterface;
	constructor(iface: dbusInterface) {
		this.iface = iface;
	}
}

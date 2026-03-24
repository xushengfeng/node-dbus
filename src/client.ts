import type { dbusIO } from "./dbus";
import { dbusMessage } from "./message";

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

    async call(method: string, ...args: unknown[]): Promise<dbusMessage> {
        const msg = new dbusMessage();
        msg.setDestination(this.op.destination);
        msg.setPath(this.op.path);
        msg.setInterface(this.op.interface);
        msg.setMember(method);
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
        console.log("msg", msg);

        const response = await this.io.call(msg);
        return response.getBody()[0];
    }

    async set(property: string, value: unknown, signature: string): Promise<void> {
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

    on(signal: string, callback: (...args: unknown[]) => void): void {
        // TODO: 实现信号订阅
    }
}

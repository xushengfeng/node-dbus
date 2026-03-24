import { dbusClient, type dbusInterface } from "./client";
import type { dbusIO } from "./dbus";

export class dbusServer {
    private io: dbusIO;
    private name: string;
    private iface: dbusInterface | null = null;
    private handlers: Map<string, Map<string, Map<string, (...args: unknown[]) => unknown>>> = new Map();

    constructor(io: dbusIO, name: string) {
        this.io = io;
        this.name = name;
    }

    async init(): Promise<void> {
        const client = new dbusClient({ io: this.io });
        const service = await client.getService("org.freedesktop.DBus");
        const obj = await service.getObject("/org/freedesktop/DBus");
        this.iface = await obj.getInterface("org.freedesktop.DBus");
        await this.iface.call("RequestName", this.name, 0);
    }

    addObject(path: string, iface: string, methods: Record<string, (...args: unknown[]) => unknown>): void {
        if (!this.handlers.has(path)) {
            this.handlers.set(path, new Map());
        }
        const pathHandlers = this.handlers.get(path)!;
        pathHandlers.set(iface, new Map(Object.entries(methods)));
    }

    getHandler(path: string, iface: string, method: string): ((...args: unknown[]) => unknown) | undefined {
        return this.handlers.get(path)?.get(iface)?.get(method);
    }

    async start(): Promise<void> {
        // TODO: 实现消息循环
    }
}

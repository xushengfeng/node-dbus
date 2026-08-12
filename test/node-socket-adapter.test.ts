import { ChildProcess, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import net from "net";
import { NodeSocketAdapter, createNodeSocketAdapter } from "../src/node-socket-adapter";
import { dbusClient } from "../src/client";
import { dbusIO } from "../src/dbus";

describe("NodeSocketAdapter", () => {
	it("should create adapter from net.Socket", () => {
		const socket = new net.Socket();
		const adapter = new NodeSocketAdapter(socket);
		expect(adapter).toBeInstanceOf(NodeSocketAdapter);
		socket.destroy();
	});

	it("should create adapter using factory function", () => {
		const socket = new net.Socket();
		const adapter = createNodeSocketAdapter(socket);
		expect(adapter).toBeInstanceOf(NodeSocketAdapter);
		socket.destroy();
	});

	it("should emit data event from underlying socket", () => {
		const socket = new net.Socket();
		const adapter = new NodeSocketAdapter(socket);
		const dataHandler = vi.fn();

		adapter.on("data", dataHandler);

		// Simulate data event from underlying socket
		const testBuffer = Buffer.from("test data");
		socket.emit("data", testBuffer);

		expect(dataHandler).toHaveBeenCalledWith(testBuffer, []);
		socket.destroy();
	});

	it("should emit connect event from underlying socket", () => {
		const socket = new net.Socket();
		const adapter = new NodeSocketAdapter(socket);
		const connectHandler = vi.fn();

		adapter.on("connect", connectHandler);

		// Simulate connect event from underlying socket
		socket.emit("connect");

		expect(connectHandler).toHaveBeenCalled();
		socket.destroy();
	});

	it("should emit error event from underlying socket", () => {
		const socket = new net.Socket();
		const adapter = new NodeSocketAdapter(socket);
		const errorHandler = vi.fn();

		adapter.on("error", errorHandler);

		// Simulate error event from underlying socket
		const testError = new Error("test error");
		socket.emit("error", testError);

		expect(errorHandler).toHaveBeenCalledWith(testError);
		socket.destroy();
	});

	it("should emit close event from underlying socket", () => {
		const socket = new net.Socket();
		const adapter = new NodeSocketAdapter(socket);
		const closeHandler = vi.fn();

		adapter.on("close", closeHandler);

		// Simulate close event from underlying socket
		socket.emit("close");

		expect(closeHandler).toHaveBeenCalled();
		socket.destroy();
	});

	it("should write data to underlying socket", () => {
		const socket = new net.Socket();
		const adapter = new NodeSocketAdapter(socket);
		const writeSpy = vi.spyOn(socket, "write");

		const testBuffer = Buffer.from("test data");
		adapter.write(testBuffer);

		expect(writeSpy).toHaveBeenCalledWith(testBuffer, expect.any(String), expect.any(Function));
		socket.destroy();
	});

	it("should destroy underlying socket", () => {
		const socket = new net.Socket();
		const adapter = new NodeSocketAdapter(socket);
		const destroySpy = vi.spyOn(socket, "destroy");

		adapter.destroy();

		expect(destroySpy).toHaveBeenCalled();
	});

	it("should not destroy twice", () => {
		const socket = new net.Socket();
		const adapter = new NodeSocketAdapter(socket);
		const destroySpy = vi.spyOn(socket, "destroy");

		adapter.destroy();
		adapter.destroy();

		expect(destroySpy).toHaveBeenCalledTimes(1);
	});

	it("should call connect on underlying socket", () => {
		const socket = new net.Socket();
		const adapter = new NodeSocketAdapter(socket);
		const connectSpy = vi.spyOn(socket, "connect");

		const callback = vi.fn();
		adapter.connect("/test/path", callback);

		expect(connectSpy).toHaveBeenCalledWith("/test/path", callback);
		socket.destroy();
	});

	it("should work with dbusIO constructor", async () => {
		const { dbusIO } = await import("../src/dbus");
		const socket = new net.Socket();
		const adapter = createNodeSocketAdapter(socket);

		// This should not throw
		const io = new dbusIO({ socket: adapter });
		expect(io).toBeDefined();
		socket.destroy();
	});
});

const SOCKET_PATH = path.join(__dirname, "test-node-adapter-bus.sock");

describe("NodeSocketAdapter Integration", () => {
	let nodeSocket: net.Socket;
	let adapter: NodeSocketAdapter;
	let io: dbusIO;
	let daemon: ChildProcess;

	beforeAll(async () => {
		if (fs.existsSync(SOCKET_PATH)) {
			fs.unlinkSync(SOCKET_PATH);
		}

		daemon = spawn("dbus-daemon", [
			"--session",
			`--address=unix:path=${SOCKET_PATH}`,
			"--print-address",
		]);

		await new Promise<void>((resolve, reject) => {
			daemon.stdout?.on("data", () => {
				resolve();
			});
			daemon.on("error", reject);
			setTimeout(() => reject(new Error("Daemon start timeout")), 5000);
		});

		nodeSocket = new net.Socket();
		adapter = createNodeSocketAdapter(nodeSocket);

		await new Promise<void>((resolve, reject) => {
			nodeSocket.connect(SOCKET_PATH, () => resolve());
			nodeSocket.on("error", reject);
			setTimeout(() => reject(new Error("Connection timeout")), 5000);
		});

		io = new dbusIO({ socket: adapter });
		await io.connect();
	});

	afterAll(() => {
		nodeSocket?.destroy();
		daemon?.kill();
		try {
			if (fs.existsSync(SOCKET_PATH)) {
				fs.unlinkSync(SOCKET_PATH);
			}
		} catch (e) {}
	});

	it("should connect and authenticate with NodeSocketAdapter", () => {
		expect(nodeSocket).toBeDefined();
		expect(adapter).toBeDefined();
		expect(io).toBeDefined();
	});

	it("should get dbus features using NodeSocketAdapter", async () => {
		const client = new dbusClient({ io });
		const service = await client.getService("org.freedesktop.DBus");
		const obj = await service.getObject("/org/freedesktop/DBus");
		const iface = await obj.getInterface("org.freedesktop.DBus");

		const features = (await iface.get<"v">("Features"))[0];
		expect(Array.isArray(features)).toBe(true);
	});
});

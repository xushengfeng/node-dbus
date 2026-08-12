import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbusClient } from "../src/client";
import { dbusIO } from "../src/dbus";

const SOCKET_PATH = path.join(__dirname, "test-net-socket-bus.sock");

describe("net.Socket 兼容性测试", () => {
	let socket: net.Socket;
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

		socket = new net.Socket();
		await new Promise<void>((resolve, reject) => {
			socket.connect(SOCKET_PATH, () => resolve());
			socket.on("error", reject);
			setTimeout(() => reject(new Error("Connection timeout")), 5000);
		});

		io = new dbusIO({ socket });
		await io.connect();
	});

	afterAll(() => {
		socket?.destroy();
		daemon?.kill();
		try {
			if (fs.existsSync(SOCKET_PATH)) {
				fs.unlinkSync(SOCKET_PATH);
			}
		} catch {}
	});

	it("应该能够使用 net.Socket 连接到 D-Bus", () => {
		expect(socket).toBeDefined();
		expect(io).toBeDefined();
	});

	it("应该能够调用 ListNames 获取总线名列表", async () => {
		const client = new dbusClient({ io });
		const meta = await client.getMetaInterface();
		const [names] = await meta.ListNames();
		expect(Array.isArray(names)).toBe(true);
		expect(names.length).toBeGreaterThan(0);
	});

	it("应该能够获取 Features 属性", async () => {
		const client = new dbusClient({ io });
		const service = await client.getService("org.freedesktop.DBus");
		const obj = await service.getObject("/org/freedesktop/DBus");
		const iface = await obj.getInterface("org.freedesktop.DBus");

		const [features] = await iface.get<"v">("Features");
		expect(Array.isArray(features)).toBe(true);
	});

	it("应该能够监听信号", async () => {
		const client = new dbusClient({ io });
		const meta = await client.getMetaInterface();

		let signalReceived = false;
		const off = await meta.onNameOwnerChanged(() => {
			signalReceived = true;
		});

		// 触发一个信号：请求一个不存在的名称
		await meta.RequestName("com.test.NetSocketTest", 0);
		await meta.ReleaseName("com.test.NetSocketTest");

		// 等待信号传播
		await new Promise((resolve) => setTimeout(resolve, 100));

		off();
		expect(signalReceived).toBe(true);
	});
});

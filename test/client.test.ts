import { ChildProcess, spawn } from "child_process";
import fs from "fs";
import path from "path";
const mus = require("myde-unix-socket") as typeof import("myde-unix-socket");
import type { USocket } from "myde-unix-socket";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbusClient } from "../src/client";
import { dbusIO } from "../src/dbus";

const SOCKET_PATH = path.join(__dirname, "test-bus.sock");

describe("D-Bus Client Integration", () => {
	let socket: USocket;
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

		socket = new mus.USocket();
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
		} catch (e) {}
	});

	it("should connect and authenticate", () => {
		expect(socket).toBeDefined();
		expect(io).toBeDefined();
	});

	it("should get dbus features", async () => {
		const client = new dbusClient({ io });
		const service = await client.getService("org.freedesktop.DBus");
		const obj = await service.getObject("/org/freedesktop/DBus");
		const iface = await obj.getInterface("org.freedesktop.DBus");

		const features = (await iface.get<"v">("Features"))[0];
		expect(Array.isArray(features)).toBe(true);
	});
});

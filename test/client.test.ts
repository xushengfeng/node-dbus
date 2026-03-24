import { ChildProcess, spawn } from "child_process";
import fs from "fs";
import path from "path";
const mus = require("myde-unix-socket") as typeof import("myde-unix-socket");
import type { USocket } from "myde-unix-socket";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbusClient } from "../src/client";
import { dbusIO } from "../src/dbus";
import { dbusMessage } from "../src/message";

const SOCKET_PATH = path.join(__dirname, "test-bus.sock");

function getUid(): string {
	return process.getuid?.()?.toString() ?? "1000";
}

function encodeUid(uid: string): string {
	return Array.from(uid)
		.map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
		.join("");
}

async function authenticate(socket: USocket): Promise<void> {
	const uid = getUid();
	const encodedUid = encodeUid(uid);
	return new Promise((resolve, reject) => {
		const chunks: Uint8Array[] = [];

		const onData = (data: Buffer) => {
			chunks.push(new Uint8Array(data));
			const totalLen = chunks.reduce((s, c) => s + c.length, 0);
			const buffer = new Uint8Array(totalLen);
			let offset = 0;
			for (const c of chunks) {
				buffer.set(c, offset);
				offset += c.length;
			}
			const str = new TextDecoder().decode(buffer);

			if (str.includes("\n")) {
				const line = str.split("\n")[0];

				if (line.startsWith("OK")) {
					socket.write(Buffer.from("BEGIN\r\n"));
					socket.off("data", onData);
					resolve();
				} else if (line.startsWith("ERROR")) {
					socket.off("data", onData);
					reject(new Error(`Auth error: ${line}`));
				}
			}
		};

		socket.on("data", onData);
		socket.write(Buffer.from([0]));
		socket.write(Buffer.from(`AUTH EXTERNAL ${encodedUid}\r\n`));

		setTimeout(() => {
			socket.off("data", onData);
			reject(new Error("Auth timeout"));
		}, 2000);
	});
}

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
			daemon.stdout?.on("data", (data) => {
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

		await authenticate(socket);
		io = new dbusIO({ socket });

		// Call Hello to register with the bus
		await new Promise(r => setTimeout(r, 100));
		const helloMsg = new dbusMessage();
		helloMsg.setDestination("org.freedesktop.DBus");
		helloMsg.setPath("/org/freedesktop/DBus");
		helloMsg.setInterface("org.freedesktop.DBus");
		helloMsg.setMember("Hello");
		await io.call(helloMsg);
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

	it("should list names on system bus", async () => {
		const msg = new dbusMessage();
		msg.setDestination("org.freedesktop.DBus");
		msg.setPath("/org/freedesktop/DBus");
		msg.setInterface("org.freedesktop.DBus");
		msg.setMember("ListNames");

		const response = await io.call(msg);
		const names = response.getBody()[0] as string[];

		expect(Array.isArray(names)).toBe(true);
		expect(names).toContain("org.freedesktop.DBus");
	});

	it("should get unique name", async () => {
		const msg = new dbusMessage();
		msg.setDestination("org.freedesktop.DBus");
		msg.setPath("/org/freedesktop/DBus");
		msg.setInterface("org.freedesktop.DBus");
		msg.setMember("GetNameOwner");
		msg.setSignature("s");
		msg.setBody(["org.freedesktop.DBus"]);

		const response = await io.call(msg);
		const owner = response.getBody()[0] as string;

		expect(owner).toBe("org.freedesktop.DBus");
	});

	it("should get dbus version", async () => {
		const client = new dbusClient({ io });
		const service = await client.getService("org.freedesktop.DBus");
		const obj = await service.getObject("/org/freedesktop/DBus");
		const iface = await obj.getInterface("org.freedesktop.DBus");

		const version = await iface.get("Version");
		expect(typeof version).toBe("string");
	});
});

// import { USocket } from "myde-unix-socket";
const mus = require("myde-unix-socket") as typeof import("myde-unix-socket");
import type { USocket } from "myde-unix-socket";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbusClient } from "../src/client";
import { dbusIO } from "../src/dbus";
import { dbusMessage } from "../src/message";

const SYSTEM_BUS = "/var/run/dbus/system_bus_socket";
const BUS = "/run/user/1000/bus";

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
	socket.write(`AUTH EXTERNAL ${encodedUid}\r\n`);

	return new Promise((resolve, reject) => {
		const chunks: Uint8Array[] = [];

		const onData = (data: Buffer) => {
			console.log(data.toString());

			chunks.push(new Uint8Array(data));
			const totalLen = chunks.reduce((s, c) => s + c.length, 0);
			const buffer = new Uint8Array(totalLen);
			let offset = 0;
			for (const c of chunks) {
				buffer.set(c, offset);
				offset += c.length;
			}
			const str = new TextDecoder().decode(buffer);
			console.log(str);

			if (str.includes("\n")) {
				const line = str.split("\n")[0];

				if (line.startsWith("OK")) {
					socket.write("BEGIN\r\n");
					socket.off("data", onData);
					resolve();
				} else if (line.startsWith("ERROR")) {
					socket.off("data", onData);
					reject(new Error(`Auth error: ${line}`));
				}
			}
		};

		socket.on("data", onData);

		setTimeout(() => {
			socket.off("data", onData);
			reject(new Error("Auth timeout"));
		}, 2000);
	});
}

describe("D-Bus Client Integration", () => {
	let socket: USocket;
	let io: dbusIO;

	beforeAll(async () => {
		socket = new mus.USocket();
		await new Promise<void>((resolve, reject) => {
			socket.connect(BUS, () => resolve());
			socket.on("error", reject);
			setTimeout(() => reject(new Error("Connection timeout")), 5000);
		});

		await authenticate(socket);
		io = new dbusIO({ socket });
	});

	afterAll(() => {
		socket?.destroy();
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

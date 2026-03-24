import { ChildProcess, spawn } from "child_process";
import fs from "fs";
import path from "path";
const mus = require("myde-unix-socket") as typeof import("myde-unix-socket");
import type { USocket } from "myde-unix-socket";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbusClient } from "../src/client";
import { dbusServer } from "../src/server";
import { dbusIO } from "../src/dbus";
import { dbusMessage } from "../src/message";

const SOCKET_PATH = path.join(__dirname, "test-server-bus.sock");

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

describe("D-Bus Server and Client Integration", () => {
	let clientSocket: USocket;
	let serverSocket: USocket;
	let clientIO: dbusIO;
	let serverIO: dbusIO;
	let daemon: ChildProcess;
	let server: dbusServer;

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
			daemon.stdout?.on("data", () => resolve());
			daemon.on("error", reject);
			setTimeout(() => reject(new Error("Daemon start timeout")), 5000);
		});

		// Connect Server
		serverSocket = new mus.USocket();
		await new Promise<void>((resolve, reject) => {
			serverSocket.connect(SOCKET_PATH, () => resolve());
			serverSocket.on("error", reject);
		});
		await authenticate(serverSocket);
		serverIO = new dbusIO({ socket: serverSocket });

		// Register with bus
		const helloMsg1 = new dbusMessage();
		helloMsg1.setDestination("org.freedesktop.DBus");
		helloMsg1.setPath("/org/freedesktop/DBus");
		helloMsg1.setInterface("org.freedesktop.DBus");
		helloMsg1.setMember("Hello");
		await serverIO.call(helloMsg1);

		// Connect Client
		clientSocket = new mus.USocket();
		await new Promise<void>((resolve, reject) => {
			clientSocket.connect(SOCKET_PATH, () => resolve());
			clientSocket.on("error", reject);
		});
		await authenticate(clientSocket);
		clientIO = new dbusIO({ socket: clientSocket });

		// Register with bus
		const helloMsg2 = new dbusMessage();
		helloMsg2.setDestination("org.freedesktop.DBus");
		helloMsg2.setPath("/org/freedesktop/DBus");
		helloMsg2.setInterface("org.freedesktop.DBus");
		helloMsg2.setMember("Hello");
		await clientIO.call(helloMsg2);

        // Initialize Server
        server = new dbusServer(serverIO, "com.example.TestServer");
        await server.init();
	});

	afterAll(() => {
		clientSocket?.destroy();
		serverSocket?.destroy();
		daemon?.kill();
		try {
			if (fs.existsSync(SOCKET_PATH)) {
				fs.unlinkSync(SOCKET_PATH);
			}
		} catch (e) {}
	});

	it("should serve methods and respond to client calls", async () => {
        // Expose a method on the server
        server.addObject("/com/example/TestObject", "com.example.TestInterface", {
            Echo: (text: string) => {
                return text;
            },
            Add: (a: number, b: number) => {
                return a + b;
            },
            ReturnDict: () => {
                return { signature: "a{sv}", values: [[
                    [{ signature: "s", value: "key1" }, { signature: "v", value: { signature: "s", value: "value1" } }]
                ]]};
            }
        });

        const client = new dbusClient({ io: clientIO });
        const service = await client.getService("com.example.TestServer");
        const obj = await service.getObject("/com/example/TestObject");
        const iface = await obj.getInterface("com.example.TestInterface");

        // Test Echo
        const echoRes = await iface.call("Echo", "s", "hello world");
        expect(echoRes.getBody()[0]).toBe("hello world");

        // Test Add
        const addRes = await iface.call("Add", "ii", 5, 7);
        expect(addRes.getBody()[0]).toBe(12);

        // Test Unknown Method
        try {
            await iface.call("UnknownMethod", "");
            expect(true).toBe(false); // should not reach here
        } catch (e: any) {
            expect(e.message).toContain("UnknownMethod");
        }
	});

    it("should emit and receive signals", async () => {
        const client = new dbusClient({ io: clientIO });
        const service = await client.getService("com.example.TestServer");
        const obj = await service.getObject("/com/example/TestObject");
        const iface = await obj.getInterface("com.example.TestInterface");

        const signalPromise = new Promise<string>((resolve) => {
            iface.on("TestSignal", (text: unknown) => {
                resolve(text as string);
            });
        });

        // Emit from server
        setTimeout(() => {
            server.emitSignal("/com/example/TestObject", "com.example.TestInterface", "TestSignal", "s", ["signal_data"]);
        }, 100);

        const data = await signalPromise;
        expect(data).toBe("signal_data");
    });
});

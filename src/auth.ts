import type { USocket } from "myde-unix-socket";
import type net from "net";

/** 可用于 D-Bus 连接的 socket 类型 */
export type SocketLike = USocket | net.Socket;

/** 获取当前进程的 UID */
function getUid(): string {
	return process.getuid?.()?.toString() ?? "1000";
}

/** 将 UID 字符串编码为十六进制 */
function encodeUid(uid: string): string {
	return Array.from(uid)
		.map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
		.join("");
}

/**
 * 使用 EXTERNAL 机制对 D-Bus socket 进行认证
 * @param socket - 要认证的 socket 连接
 */
export async function authenticate(socket: SocketLike): Promise<void> {
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
		socket.write(Buffer.from([0])); // null byte
		socket.write(Buffer.from(`AUTH EXTERNAL ${encodedUid}\r\n`));

		setTimeout(() => {
			socket.off("data", onData);
			reject(new Error("Auth timeout"));
		}, 5000);
	});
}

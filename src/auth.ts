import type { USocket } from "myde-unix-socket";

function getUid(): string {
	return process.getuid?.()?.toString() ?? "1000";
}

function encodeUid(uid: string): string {
	return Array.from(uid)
		.map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
		.join("");
}

export async function authenticate(socket: USocket): Promise<void> {
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

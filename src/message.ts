import { Codec, Decoder, splitSignature } from "./codec";
import {
	align,
	Endian,
	type HeaderField,
	HeaderFieldCode,
	type Message,
	MessageType,
} from "./types";

export class dbusMessage {
	private message: Message;

	constructor(message?: Partial<Message>) {
		this.message = {
			header: {
				endian: message?.header?.endian ?? Endian.Little,
				type: message?.header?.type ?? MessageType.MethodCall,
				flags: message?.header?.flags ?? 0,
				version: message?.header?.version ?? 1,
				bodyLength: message?.header?.bodyLength ?? 0,
				serial: message?.header?.serial ?? 0,
				fields: message?.header?.fields ?? [],
			},
			body: message?.body ?? [],
		};
	}

	getType(): MessageType {
		return this.message.header.type;
	}
	setType(type: MessageType): void {
		this.message.header.type = type;
	}
	getSerial(): number {
		return this.message.header.serial;
	}
	setSerial(serial: number): void {
		this.message.header.serial = serial;
	}
	getPath(): string | undefined {
		return this.getField(HeaderFieldCode.Path) as string | undefined;
	}
	setPath(path: string): void {
		this.setField(HeaderFieldCode.Path, path);
	}
	getInterface(): string | undefined {
		return this.getField(HeaderFieldCode.Interface) as string | undefined;
	}
	setInterface(iface: string): void {
		this.setField(HeaderFieldCode.Interface, iface);
	}
	getMember(): string | undefined {
		return this.getField(HeaderFieldCode.Member) as string | undefined;
	}
	setMember(member: string): void {
		this.setField(HeaderFieldCode.Member, member);
	}
	getDestination(): string | undefined {
		return this.getField(HeaderFieldCode.Destination) as string | undefined;
	}
	setDestination(destination: string): void {
		this.setField(HeaderFieldCode.Destination, destination);
	}
	getSender(): string | undefined {
		return this.getField(HeaderFieldCode.Sender) as string | undefined;
	}
	setSender(sender: string): void {
		this.setField(HeaderFieldCode.Sender, sender);
	}
	getSignature(): string {
		return (this.getField(HeaderFieldCode.Signature) as string) ?? "";
	}
	setSignature(signature: string): void {
		this.setField(HeaderFieldCode.Signature, signature);
	}
	getReplySerial(): number | undefined {
		return this.getField(HeaderFieldCode.ReplySerial) as number | undefined;
	}
	setReplySerial(serial: number): void {
		this.setField(HeaderFieldCode.ReplySerial, serial);
	}
	getErrorName(): string | undefined {
		return this.getField(HeaderFieldCode.ErrorName) as string | undefined;
	}
	setErrorName(errorName: string): void {
		this.setField(HeaderFieldCode.ErrorName, errorName);
	}
	getUnixFds(): number | undefined {
		return this.getField(HeaderFieldCode.UnixFds) as number | undefined;
	}
	setUnixFds(count: number): void {
		this.setField(HeaderFieldCode.UnixFds, count);
	}
	getBody(): unknown[] {
		return this.message.body;
	}
	setBody(body: unknown[]): void {
		this.message.body = body;
	}

	private getField(code: HeaderFieldCode): unknown {
		const field = this.message.header.fields.find((f) => f.code === code);
		return field?.value;
	}

	private setField(code: HeaderFieldCode, value: unknown): void {
		const field = this.message.header.fields.find((f) => f.code === code);
		if (field) {
			field.value = value;
		} else {
			this.message.header.fields.push({ code, value });
		}
	}

	encode(): Uint8Array {
		return encodeMessage(this.message);
	}

	static decode(data: Uint8Array): { message: dbusMessage; consumed: number } {
		const decoded = decodeMessage(data);
		return {
			message: new dbusMessage(decoded.message),
			consumed: decoded.consumed,
		};
	}

	toJSON(): Message {
		return JSON.parse(JSON.stringify(this.message));
	}
}

function getSignatureForField(code: HeaderFieldCode): string {
	switch (code) {
		case HeaderFieldCode.Path:
			return "o";
		case HeaderFieldCode.Interface:
		case HeaderFieldCode.Member:
		case HeaderFieldCode.ErrorName:
		case HeaderFieldCode.Destination:
		case HeaderFieldCode.Sender:
			return "s";
		case HeaderFieldCode.ReplySerial:
		case HeaderFieldCode.UnixFds:
			return "u";
		case HeaderFieldCode.Signature:
			return "g";
		default:
			throw new Error(`Unknown header field code: ${code}`);
	}
}

function encodeMessage(message: Message): Uint8Array {
	const endian = message.header.endian;

	const signature =
		(message.header.fields.find((f) => f.code === HeaderFieldCode.Signature)
			?.value as string) ?? "";
	const bodyCodec = new Codec(endian);

	const sigParts = splitSignature(signature);
	for (let i = 0; i < message.body.length && i < sigParts.length; i++) {
		bodyCodec.writeValue(message.body[i], sigParts[i]);
	}

	const bodyPart = bodyCodec.toUint8Array();
	const bodyLength = bodyPart.length;

	const codec = new Codec(endian);
	codec.writeByte(endian);
	codec.writeByte(message.header.type);
	codec.writeByte(message.header.flags);
	codec.writeByte(message.header.version);
	codec.writeUint32(bodyLength);
	codec.writeUint32(message.header.serial);

	// Array length placeholder
	const arrayLengthOffset = codec.length;
	codec.writeUint32(0);

	// Array structural elements must be 8-byte aligned
	// But actually DBus structs in arrays are 8-byte aligned
	// Wait, let's just write the fields!
	const fieldsStart = codec.length;
	for (const field of message.header.fields) {
		// STRUCT alignment
		const pad = align(codec.length, 8);
		for (let i = 0; i < pad; i++) codec.writeByte(0);

		codec.writeByte(field.code);
		const sig = getSignatureForField(field.code);
		codec.writeVariant(field.value, sig);
	}
	const fieldsEnd = codec.length;

	// Fill in the array length
	const view = new DataView(
		codec.data.buffer,
		codec.data.byteOffset,
		codec.data.byteLength,
	);
	if (endian === Endian.Little) {
		view.setUint32(arrayLengthOffset, fieldsEnd - fieldsStart, true);
	} else {
		view.setUint32(arrayLengthOffset, fieldsEnd - fieldsStart, false);
	}

	// Body padding
	const bodyPad = align(codec.length, 8);
	for (let i = 0; i < bodyPad; i++) codec.writeByte(0);

	const headerPart = codec.toUint8Array();

	const result = new Uint8Array(headerPart.length + bodyPart.length);
	result.set(headerPart, 0);
	result.set(bodyPart, headerPart.length);

	return result;
}

function decodeMessage(data: Uint8Array): {
	message: Message;
	consumed: number;
} {
	const decoder = new Decoder(data);
	const endian = decoder.readByte() as Endian;
	const type = decoder.readByte() as MessageType;
	const flags = decoder.readByte();
	const version = decoder.readByte();
	const bodyLength = decoder.readUint32();
	const serial = decoder.readUint32();

	const fieldsLength = decoder.readUint32();
	const fieldsStart = decoder.position;

	const fields: HeaderField[] = [];
	while (decoder.position - fieldsStart < fieldsLength) {
		// Struct alignment
		decoder.position += align(decoder.position, 8);

		const code = decoder.readByte() as HeaderFieldCode;
		const variant = decoder.readVariant();
		fields.push({ code, value: variant.value });
	}

	// Ensure we skip exactly fieldsLength bytes even if we misread
	decoder.position = fieldsStart + fieldsLength;

	// Body alignment
	decoder.position += align(decoder.position, 8);

	const signature =
		(fields.find((f) => f.code === HeaderFieldCode.Signature)
			?.value as string) ?? "";
	const body: unknown[] = [];

	if (bodyLength > 0) {
		const bodyStart = decoder.position;
		const sigParts = splitSignature(signature);
		for (let i = 0; i < sigParts.length; i++) {
			body.push(decoder.readValue(sigParts[i]));
		}
		decoder.position = bodyStart + bodyLength;
	}

	return {
		message: {
			header: { endian, type, flags, version, bodyLength, serial, fields },
			body,
		},
		consumed: decoder.position,
	};
}

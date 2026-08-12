import { Codec, Decoder, splitSignature } from "./codec";
import {
	align,
	Endian,
	type HeaderField,
	HeaderFieldCode,
	type Message,
	MessageType,
} from "./types";

/** D-Bus 消息，封装消息头和消息体的编码/解码操作 */
export class dbusMessage {
	private message: Message;

	/**
	 * 创建 D-Bus 消息
	 * @param message - 可选的部分消息结构，未提供字段使用默认值
	 */
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

	/** 获取消息类型 */
	getType(): MessageType {
		return this.message.header.type;
	}
	/** 设置消息类型 */
	setType(type: MessageType): void {
		this.message.header.type = type;
	}
	/** 获取消息序列号 */
	getSerial(): number {
		return this.message.header.serial;
	}
	/** 设置消息序列号 */
	setSerial(serial: number): void {
		this.message.header.serial = serial;
	}
	/** 获取对象路径 */
	getPath(): string | undefined {
		return this.getField(HeaderFieldCode.Path) as string | undefined;
	}
	/** 设置对象路径 */
	setPath(path: string): void {
		this.setField(HeaderFieldCode.Path, path);
	}
	/** 获取接口名 */
	getInterface(): string | undefined {
		return this.getField(HeaderFieldCode.Interface) as string | undefined;
	}
	/** 设置接口名 */
	setInterface(iface: string): void {
		this.setField(HeaderFieldCode.Interface, iface);
	}
	/** 获取成员名（方法或信号名） */
	getMember(): string | undefined {
		return this.getField(HeaderFieldCode.Member) as string | undefined;
	}
	/** 设置成员名（方法或信号名） */
	setMember(member: string): void {
		this.setField(HeaderFieldCode.Member, member);
	}
	/** 获取目标总线名 */
	getDestination(): string | undefined {
		return this.getField(HeaderFieldCode.Destination) as string | undefined;
	}
	/** 设置目标总线名 */
	setDestination(destination: string): void {
		this.setField(HeaderFieldCode.Destination, destination);
	}
	/** 获取发送者总线名 */
	getSender(): string | undefined {
		return this.getField(HeaderFieldCode.Sender) as string | undefined;
	}
	/** 设置发送者总线名 */
	setSender(sender: string): void {
		this.setField(HeaderFieldCode.Sender, sender);
	}
	/** 获取类型签名 */
	getSignature(): string {
		return (this.getField(HeaderFieldCode.Signature) as string) ?? "";
	}
	/** 设置类型签名 */
	setSignature(signature: string): void {
		this.setField(HeaderFieldCode.Signature, signature);
	}
	/** 获取回复序列号 */
	getReplySerial(): number | undefined {
		return this.getField(HeaderFieldCode.ReplySerial) as number | undefined;
	}
	/** 设置回复序列号 */
	setReplySerial(serial: number): void {
		this.setField(HeaderFieldCode.ReplySerial, serial);
	}
	/** 获取错误名 */
	getErrorName(): string | undefined {
		return this.getField(HeaderFieldCode.ErrorName) as string | undefined;
	}
	/** 设置错误名 */
	setErrorName(errorName: string): void {
		this.setField(HeaderFieldCode.ErrorName, errorName);
	}
	/** 获取 Unix 文件描述符数量 */
	getUnixFds(): number | undefined {
		return this.getField(HeaderFieldCode.UnixFds) as number | undefined;
	}
	/** 设置 Unix 文件描述符数量 */
	setUnixFds(count: number): void {
		this.setField(HeaderFieldCode.UnixFds, count);
	}
	/** 获取消息体 */
	getBody(): unknown[] {
		return this.message.body;
	}
	/** 设置消息体 */
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

	/** 将消息编码为字节数组 */
	encode(): Uint8Array {
		return encodeMessage(this.message);
	}

	/**
	 * 从字节数组解码消息
	 * @param data - 要解码的字节数据
	 * @returns 解码后的消息和消耗的字节数
	 */
	static decode(data: Uint8Array): { message: dbusMessage; consumed: number } {
		const decoded = decodeMessage(data);
		return {
			message: new dbusMessage(decoded.message),
			consumed: decoded.consumed,
		};
	}

	/** 将消息转换为 JSON 对象 */
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
		codec.writeVariant([field.value], sig);
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
		fields.push({ code, value: variant.value[0] });
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

import { Codec, Decoder } from "./codec";
import { align, Endian, type HeaderField, HeaderFieldCode, type Message, MessageType } from "./types";

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

    static decode(data: Uint8Array): dbusMessage {
        return new dbusMessage(decodeMessage(data));
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

function encodeHeaderField(field: HeaderField, endian: Endian): Uint8Array {
    const codec = new Codec(endian);
    codec.writeByte(field.code);
    const sig = getSignatureForField(field.code);
    codec.writeVariant(field.value, sig);
    return codec.toUint8Array();
}

function encodeMessage(message: Message): Uint8Array {
    const endian = message.header.endian;
    const headerFields: Uint8Array[] = [];

    for (const field of message.header.fields) {
        headerFields.push(encodeHeaderField(field, endian));
    }

    const signature = (message.header.fields.find((f) => f.code === HeaderFieldCode.Signature)?.value as string) ?? "";
    const bodyCodec = new Codec(endian);

    for (let i = 0; i < message.body.length; i++) {
        bodyCodec.writeValue(message.body[i], signature[i]);
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

    const headerStart = codec.toUint8Array();
    const headerFieldsPart = concatArrays(headerFields);
    const padding = align(headerStart.length + headerFieldsPart.length, 8);

    const result = new Uint8Array(headerStart.length + headerFieldsPart.length + padding + bodyPart.length);
    let offset = 0;
    result.set(headerStart, offset);
    offset += headerStart.length;
    result.set(headerFieldsPart, offset);
    offset += headerFieldsPart.length;
    offset += padding;
    result.set(bodyPart, offset);

    return result;
}

function decodeMessage(data: Uint8Array): Message {
    const decoder = new Decoder(data);
    const endian = decoder.readByte() as Endian;
    const type = decoder.readByte() as MessageType;
    const flags = decoder.readByte();
    const version = decoder.readByte();
    const bodyLength = decoder.readUint32();
    const serial = decoder.readUint32();

    // Header fields start at offset 12
    const headerFieldsStart = 12;
    const headerFieldsEnd = data.length - bodyLength;

    const headerDecoder = new Decoder(
        new Uint8Array(data.buffer, data.byteOffset + headerFieldsStart, headerFieldsEnd - headerFieldsStart),
        endian,
    );
    const fields: HeaderField[] = [];

    // 读取header fields，直到遇到padding或到达边界
    while (headerDecoder.position < headerFieldsEnd - headerFieldsStart) {
        // 保存当前位置，以便在读取失败时恢复
        const savedPosition = headerDecoder.position;

        try {
            const code = headerDecoder.readByte() as HeaderFieldCode;
            const variant = headerDecoder.readVariant();
            fields.push({ code, value: variant.value });
        } catch (e) {
            // 读取失败，可能是遇到了padding
            headerDecoder.position = savedPosition;
            break;
        }
    }

    const signature = (fields.find((f) => f.code === HeaderFieldCode.Signature)?.value as string) ?? "";
    const body: unknown[] = [];
    if (bodyLength > 0) {
        const bodyDecoder = new Decoder(
            new Uint8Array(data.buffer, data.byteOffset + headerFieldsEnd, bodyLength),
            endian,
        );

        for (let i = 0; i < signature.length; i++) {
            body.push(bodyDecoder.readValue(signature[i]));
        }
    }

    return {
        header: { endian, type, flags, version, bodyLength, serial, fields },
        body,
    };
}

function concatarrays(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

function concatArrays(arrays: Uint8Array[]): Uint8Array {
    return concatarrays(arrays);
}

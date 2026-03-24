import { align, Endian } from "./types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8");

export class Codec {
    private buffer: ArrayBuffer;
    private view: DataView;
    private offset: number;
    private endian: Endian;

    constructor(endian: Endian = Endian.Little, size = 256) {
        this.buffer = new ArrayBuffer(size);
        this.view = new DataView(this.buffer);
        this.offset = 0;
        this.endian = endian;
    }

    get data(): Uint8Array {
        return new Uint8Array(this.buffer, 0, this.offset);
    }

    get length(): number {
        return this.offset;
    }

    private ensureCapacity(additional: number): void {
        if (this.offset + additional > this.buffer.byteLength) {
            const newSize = Math.max(this.buffer.byteLength * 2, this.offset + additional);
            const newBuffer = new ArrayBuffer(newSize);
            new Uint8Array(newBuffer).set(new Uint8Array(this.buffer, 0, this.offset));
            this.buffer = newBuffer;
            this.view = new DataView(this.buffer);
        }
    }

    writeByte(value: number): void {
        this.ensureCapacity(1);
        this.view.setUint8(this.offset, value);
        this.offset += 1;
    }

    writeInt16(value: number): void {
        this.ensureCapacity(2);
        const pad = align(this.offset, 2);
        this.offset += pad;
        if (this.endian === Endian.Little) {
            this.view.setInt16(this.offset, value, true);
        } else {
            this.view.setInt16(this.offset, value, false);
        }
        this.offset += 2;
    }

    writeUint16(value: number): void {
        this.ensureCapacity(2);
        const pad = align(this.offset, 2);
        this.offset += pad;
        if (this.endian === Endian.Little) {
            this.view.setUint16(this.offset, value, true);
        } else {
            this.view.setUint16(this.offset, value, false);
        }
        this.offset += 2;
    }

    writeInt32(value: number): void {
        this.ensureCapacity(4);
        const pad = align(this.offset, 4);
        this.offset += pad;
        if (this.endian === Endian.Little) {
            this.view.setInt32(this.offset, value, true);
        } else {
            this.view.setInt32(this.offset, value, false);
        }
        this.offset += 4;
    }

    writeUint32(value: number): void {
        this.ensureCapacity(4);
        if (this.endian === Endian.Little) {
            this.view.setUint32(this.offset, value, true);
        } else {
            this.view.setUint32(this.offset, value, false);
        }
        this.offset += 4;
    }

    writeInt64(value: bigint): void {
        this.ensureCapacity(8);
        const pad = align(this.offset, 8);
        this.offset += pad;
        if (this.endian === Endian.Little) {
            this.view.setBigInt64(this.offset, value, true);
        } else {
            this.view.setBigInt64(this.offset, value, false);
        }
        this.offset += 8;
    }

    writeUint64(value: bigint): void {
        this.ensureCapacity(8);
        const pad = align(this.offset, 8);
        this.offset += pad;
        if (this.endian === Endian.Little) {
            this.view.setBigUint64(this.offset, value, true);
        } else {
            this.view.setBigUint64(this.offset, value, false);
        }
        this.offset += 8;
    }

    writeDouble(value: number): void {
        this.ensureCapacity(8);
        const pad = align(this.offset, 8);
        this.offset += pad;
        if (this.endian === Endian.Little) {
            this.view.setFloat64(this.offset, value, true);
        } else {
            this.view.setFloat64(this.offset, value, false);
        }
        this.offset += 8;
    }

    writeBoolean(value: boolean): void {
        this.writeUint32(value ? 1 : 0);
    }

    writeSignature(sig: string): void {
        this.ensureCapacity(1 + sig.length + 1);
        this.view.setUint8(this.offset, sig.length);
        this.offset += 1;
        const encoded = textEncoder.encode(sig);
        new Uint8Array(this.buffer, this.offset, encoded.length).set(encoded);
        this.offset += encoded.length;
        this.view.setUint8(this.offset, 0);
        this.offset += 1;
    }

    writeString(value: string): void {
        const encoded = textEncoder.encode(value);
        this.writeUint32(encoded.length);
        this.ensureCapacity(encoded.length + 1);
        new Uint8Array(this.buffer, this.offset, encoded.length).set(encoded);
        this.offset += encoded.length;
        this.view.setUint8(this.offset, 0);
        this.offset += 1;
    }

    writeObjectPath(path: string): void {
        this.writeString(path);
    }

    writeVariant(value: unknown, signature: string): void {
        this.writeSignature(signature);
        this.writeValue(value, signature);
    }

    writeValue(value: unknown, signature: string): void {
        switch (signature) {
            case "y":
                this.writeByte(value as number);
                break;
            case "n":
                this.writeInt16(value as number);
                break;
            case "q":
                this.writeUint16(value as number);
                break;
            case "i":
                this.writeInt32(value as number);
                break;
            case "u":
                this.writeUint32(value as number);
                break;
            case "x":
                this.writeInt64(BigInt(value as number));
                break;
            case "t":
                this.writeUint64(BigInt(value as number));
                break;
            case "d":
                this.writeDouble(value as number);
                break;
            case "b":
                this.writeBoolean(value as boolean);
                break;
            case "s":
                this.writeString(value as string);
                break;
            case "o":
                this.writeObjectPath(value as string);
                break;
            case "g":
                this.writeSignature(value as string);
                break;
            case "v":
                this.writeVariant(
                    (value as { value: unknown; signature: string }).value,
                    (value as { value: unknown; signature: string }).signature,
                );
                break;
            default:
                throw new Error(`Unsupported signature: ${signature}`);
        }
    }

    toUint8Array(): Uint8Array {
        return new Uint8Array(this.buffer, 0, this.offset);
    }
}

export class Decoder {
    view: DataView;
    offset: number;
    private endian: Endian;

    constructor(data: Uint8Array, endian: Endian = Endian.Little) {
        this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        this.offset = 0;
        this.endian = endian;
    }

    get position(): number {
        return this.offset;
    }

    set position(value: number) {
        this.offset = value;
    }

    readByte(): number {
        const value = this.view.getUint8(this.offset);
        this.offset += 1;
        return value;
    }

    readInt16(): number {
        this.offset += align(this.offset, 2);
        const value =
            this.endian === Endian.Little
                ? this.view.getInt16(this.offset, true)
                : this.view.getInt16(this.offset, false);
        this.offset += 2;
        return value;
    }

    readUint16(): number {
        this.offset += align(this.offset, 2);
        const value =
            this.endian === Endian.Little
                ? this.view.getUint16(this.offset, true)
                : this.view.getUint16(this.offset, false);
        this.offset += 2;
        return value;
    }

    readInt32(): number {
        this.offset += align(this.offset, 4);
        const value =
            this.endian === Endian.Little
                ? this.view.getInt32(this.offset, true)
                : this.view.getInt32(this.offset, false);
        this.offset += 4;
        return value;
    }

    readUint32(): number {
        const value =
            this.endian === Endian.Little
                ? this.view.getUint32(this.offset, true)
                : this.view.getUint32(this.offset, false);
        this.offset += 4;
        return value;
    }

    readInt64(): bigint {
        this.offset += align(this.offset, 8);
        const value =
            this.endian === Endian.Little
                ? this.view.getBigInt64(this.offset, true)
                : this.view.getBigInt64(this.offset, false);
        this.offset += 8;
        return value;
    }

    readUint64(): bigint {
        this.offset += align(this.offset, 8);
        const value =
            this.endian === Endian.Little
                ? this.view.getBigUint64(this.offset, true)
                : this.view.getBigUint64(this.offset, false);
        this.offset += 8;
        return value;
    }

    readDouble(): number {
        this.offset += align(this.offset, 8);
        const value =
            this.endian === Endian.Little
                ? this.view.getFloat64(this.offset, true)
                : this.view.getFloat64(this.offset, false);
        this.offset += 8;
        return value;
    }

    readBoolean(): boolean {
        return this.readUint32() !== 0;
    }

    readSignature(): string {
        const length = this.view.getUint8(this.offset);
        this.offset += 1;
        const value = textDecoder.decode(new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length));
        this.offset += length + 1;
        return value;
    }

    readString(): string {
        const length = this.readUint32();
        const value = textDecoder.decode(new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length));
        this.offset += length + 1;
        return value;
    }

    readObjectPath(): string {
        return this.readString();
    }

    readVariant(): { value: unknown; signature: string } {
        const signature = this.readSignature();
        const value = this.readValue(signature);
        return { value, signature };
    }

    readValue(signature: string): unknown {
        switch (signature) {
            case "y":
                return this.readByte();
            case "n":
                return this.readInt16();
            case "q":
                return this.readUint16();
            case "i":
                return this.readInt32();
            case "u":
                return this.readUint32();
            case "x":
                return Number(this.readInt64());
            case "t":
                return Number(this.readUint64());
            case "d":
                return this.readDouble();
            case "b":
                return this.readBoolean();
            case "s":
                return this.readString();
            case "o":
                return this.readObjectPath();
            case "g":
                return this.readSignature();
            case "v":
                return this.readVariant();
            default:
                throw new Error(`Unsupported signature: ${signature}`);
        }
    }
}

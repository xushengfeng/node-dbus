import { describe, expect, it } from "vitest";
import {
	Codec,
	Decoder,
	dbusMessage,
	Endian,
	HeaderFieldCode,
	MessageType,
} from "../src/";

describe("Codec", () => {
	it("should write and read byte", () => {
		const codec = new Codec();
		codec.writeByte(42);
		const decoder = new Decoder(codec.toUint8Array());
		expect(decoder.readByte()).toBe(42);
	});

	it("should write and read uint32", () => {
		const codec = new Codec();
		codec.writeUint32(0x12345678);
		const decoder = new Decoder(codec.toUint8Array());
		expect(decoder.readUint32()).toBe(0x12345678);
	});

	it("should write and read string", () => {
		const codec = new Codec();
		codec.writeString("Hello");
		const decoder = new Decoder(codec.toUint8Array());
		expect(decoder.readString()).toBe("Hello");
	});

	it("should write and read signature", () => {
		const codec = new Codec();
		codec.writeSignature("si");
		const decoder = new Decoder(codec.toUint8Array());
		expect(decoder.readSignature()).toBe("si");
	});

	it("should write and read object path", () => {
		const codec = new Codec();
		codec.writeObjectPath("/org/freedesktop/DBus");
		const decoder = new Decoder(codec.toUint8Array());
		expect(decoder.readObjectPath()).toBe("/org/freedesktop/DBus");
	});

	it("should write and read variant", () => {
		const codec = new Codec();
		codec.writeVariant("Hello", "s");
		const decoder = new Decoder(codec.toUint8Array());
		const result = decoder.readVariant();
		expect(result.value).toBe("Hello");
		expect(result.signature).toBe("s");
	});

	it("should handle little endian", () => {
		const codec = new Codec(Endian.Little);
		codec.writeUint32(0x12345678);
		const decoder = new Decoder(codec.toUint8Array(), Endian.Little);
		expect(decoder.readUint32()).toBe(0x12345678);
	});

	it("should handle big endian", () => {
		const codec = new Codec(Endian.Big);
		codec.writeUint32(0x12345678);
		const decoder = new Decoder(codec.toUint8Array(), Endian.Big);
		expect(decoder.readUint32()).toBe(0x12345678);
	});
});

describe("dbusMessage", () => {
	it("should create with defaults", () => {
		const msg = new dbusMessage();
		expect(msg.getType()).toBe(MessageType.MethodCall);
		expect(msg.getSerial()).toBe(0);
		expect(msg.getBody()).toEqual([]);
	});

	it("should set and get properties", () => {
		const msg = new dbusMessage();
		msg.setPath("/test/path");
		msg.setInterface("test.Interface");
		msg.setMember("TestMethod");
		msg.setDestination("test.dest");
		msg.setSignature("s");
		msg.setBody(["Hello"]);

		expect(msg.getPath()).toBe("/test/path");
		expect(msg.getInterface()).toBe("test.Interface");
		expect(msg.getMember()).toBe("TestMethod");
		expect(msg.getDestination()).toBe("test.dest");
		expect(msg.getSignature()).toBe("s");
		expect(msg.getBody()).toEqual(["Hello"]);
	});

	it("should encode empty body message", () => {
		const msg = new dbusMessage();
		msg.setSerial(1);
		msg.setPath("/org/freedesktop/DBus");
		msg.setInterface("org.freedesktop.DBus");
		msg.setMember("ListNames");
		msg.setDestination("org.freedesktop.DBus");

		const encoded = msg.encode();
		expect(encoded.length).toBeGreaterThan(12);
	});

	it("should encode and decode empty body message", () => {
		const msg = new dbusMessage();
		msg.setSerial(1);
		msg.setPath("/org/freedesktop/DBus");
		msg.setInterface("org.freedesktop.DBus");
		msg.setMember("ListNames");
		msg.setDestination("org.freedesktop.DBus");

		const encoded = msg.encode();
		const decoded = dbusMessage.decode(encoded).message;

		expect(decoded.getSerial()).toBe(1);
		expect(decoded.getPath()).toBe("/org/freedesktop/DBus");
		expect(decoded.getInterface()).toBe("org.freedesktop.DBus");
		expect(decoded.getMember()).toBe("ListNames");
		expect(decoded.getDestination()).toBe("org.freedesktop.DBus");
	});

	it("should encode and decode message with string body", () => {
		const msg = new dbusMessage();
		msg.setSerial(2);
		msg.setPath("/test/path");
		msg.setSignature("s");
		msg.setBody(["Test String"]);

		const encoded = msg.encode();
		const decoded = dbusMessage.decode(encoded).message;

		expect(decoded.getBody()).toEqual(["Test String"]);
		expect(decoded.getSignature()).toBe("s");
	});

	it("should encode and decode message with int body", () => {
		const msg = new dbusMessage();
		msg.setSerial(3);
		msg.setPath("/test/path");
		msg.setSignature("i");
		msg.setBody([42]);

		const encoded = msg.encode();
		const decoded = dbusMessage.decode(encoded).message;

		expect(decoded.getBody()).toEqual([42]);
	});

	it("should encode and decode message with bool body", () => {
		const msg = new dbusMessage();
		msg.setSerial(4);
		msg.setPath("/test/path");
		msg.setSignature("b");
		msg.setBody([true]);

		const encoded = msg.encode();
		const decoded = dbusMessage.decode(encoded).message;

		expect(decoded.getBody()).toEqual([true]);
	});

	it("should encode and decode message with multiple args", () => {
		const msg = new dbusMessage();
		msg.setSerial(5);
		msg.setPath("/test/path");
		msg.setSignature("si");
		msg.setBody(["Hello", 123]);

		const encoded = msg.encode();
		const decoded = dbusMessage.decode(encoded).message;

		expect(decoded.getBody()).toEqual(["Hello", 123]);
	});

	it("should write and read dict entries {sv}", () => {
		const codec = new Codec();
		codec.writeValue(["name", { signature: "s", value: "test" }], "{sv}");
		const decoder = new Decoder(codec.toUint8Array());
		expect(decoder.readValue("{sv}")).toEqual([
			"name",
			{ signature: "s", value: "test" },
		]);
	});

	it("should write and read complex nested struct and array (isa{sv})", () => {
		const codec = new Codec();
		const data = [
			42,
			"hello",
			[
				["key1", { signature: "s", value: "value1" }],
				["key2", { signature: "i", value: 100 }],
			],
		];
		codec.writeValue(data, "(isa{sv})");
		const decoder = new Decoder(codec.toUint8Array());
		expect(decoder.readValue("(isa{sv})")).toEqual(data);
	});

	it("should write and read array of dicts a{sv}", () => {
		const codec = new Codec();
		const data = [
			["prop1", { signature: "s", value: "val1" }],
			["prop2", { signature: "i", value: 42 }],
		];
		codec.writeValue(data, "a{sv}");
		const decoder = new Decoder(codec.toUint8Array());
		expect(decoder.readValue("a{sv}")).toEqual(data);
	});
});

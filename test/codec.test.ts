import { describe, expect, it } from "vitest";
import { Codec, Decoder, dbusMessage, Endian, MessageType } from "../src/";
import type { DBusType } from "../src/dbus_type";

describe("Codec", () => {
	function c<T extends string>(signature: T, value: DBusType<T>) {
		const codec = new Codec();
		const data = value;
		// @ts-ignore 太深
		codec.writeValue(value, signature);
		const decoder = new Decoder(codec.toUint8Array());
		expect(decoder.readValue(signature)).toEqual(data);
	}
	function cBigEndian<T extends string>(signature: T, value: DBusType<T>) {
		const codec = new Codec(Endian.Big);
		const data = value;
		// @ts-ignore 太深
		codec.writeValue(value, signature);
		const decoder = new Decoder(codec.toUint8Array(), Endian.Big);
		expect(decoder.readValue(signature)).toEqual(data);
	}
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

	it("simple", () => {
		c("y", 42);
		c("n", -12345);
		c("q", 54321);
		c("i", -123456789);
		c("u", 123456789);
		c("x", 1234567890123456789n);
		c("t", 12345678901234567890n);
		c("d", 1.23456789);
		c("b", true);
		c("s", "hello world");
		c("s", "hello".repeat(100));
		c("o", "/org/freedesktop/DBus");
		c("g", "com.example.Interface");
	});
	it("big endian", () => {
		cBigEndian("y", 42);
		cBigEndian("n", -12345);
		cBigEndian("q", 54321);
		cBigEndian("i", -123456789);
		cBigEndian("u", 123456789);
		cBigEndian("x", 1234567890123456789n);
		cBigEndian("t", 12345678901234567890n);
		cBigEndian("d", 1.23456789);
		cBigEndian("b", true);
		cBigEndian("s", "hello world");
		cBigEndian("s", "hello".repeat(100));
		cBigEndian("o", "/org/freedesktop/DBus");
		cBigEndian("g", "com.example.Interface");
	});

	it("some", () => {
		c("s", "hello");
		c("i", 42);
		c("b", true);
		c("v", { signature: "s", value: "hello" });
		c("(is)", [42, "hello"]);
		c("(i(is))", [42, [100, "world"]]);
		c("(i(is)(s))", [42, [100, "world"], ["test"]]);
		c("((i((is)))s)", [[42, [[100, "world"]]], "test"]);
		c("as", ["hello", "world", "test"]);
		c("a(is)", [
			[42, "hello"],
			[100, "world"],
		]);
		c("a(i(is))", [
			[42, [100, "hello"]],
			[100, [200, "world"]],
		]);
		c("a{sv}", [
			["name", { signature: "s", value: "test" }],
			["name2", { signature: "i", value: 42 }],
		]);
		c("a{is}", [
			[42, "hello"],
			[100, "world"],
		]);
		c("a{xv}", [
			[42n, { signature: "s", value: "hello" }],
			[100n, { signature: "i", value: 42 }],
		]);
		c("a{sa{sv}}", [
			[
				"object1",
				[
					["prop1", { signature: "s", value: "val1" }],
					["prop2", { signature: "i", value: 42 }],
				],
			],
			[
				"object2",
				[
					["propA", { signature: "s", value: "valA" }],
					["propB", { signature: "i", value: 100 }],
				],
			],
		]);
		c("a{ia{sv}}", [
			[
				42,
				[
					["prop1", { signature: "s", value: "val1" }],
					["prop2", { signature: "i", value: 42 }],
				],
			],
			[
				100,
				[
					["propA", { signature: "s", value: "valA" }],
					["propB", { signature: "i", value: 100 }],
				],
			],
		]);
		c("(isa{sv})", [
			42,
			"hello",
			[
				["key1", { signature: "s", value: "value1" }],
				["key2", { signature: "i", value: 100 }],
			],
		]);
		c("a(a{sv})", [
			[
				[
					["key1", { signature: "s", value: "value1" }],
					["key2", { signature: "i", value: 100 }],
				],
			],
			[
				[
					["keyA", { signature: "s", value: "valueA" }],
					["keyB", { signature: "i", value: 200 }],
				],
			],
		]);
		c("a{s(sib)}", [
			["entry1", ["hello", 42, true]],
			["entry2", ["world", 100, false]],
		]);
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
});

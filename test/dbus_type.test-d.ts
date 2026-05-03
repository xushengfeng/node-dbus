import { expectTypeOf } from "vitest";

import type { DBusType, DbusDict, DbusVar } from "../src/dbus_type";

expectTypeOf<DBusType<"s">>().toEqualTypeOf<string>();
expectTypeOf<DBusType<"b">>().toEqualTypeOf<boolean>();
expectTypeOf<DBusType<"n">>().toEqualTypeOf<number>();
expectTypeOf<DBusType<"q">>().toEqualTypeOf<number>();
expectTypeOf<DBusType<"i">>().toEqualTypeOf<number>();
expectTypeOf<DBusType<"u">>().toEqualTypeOf<number>();
expectTypeOf<DBusType<"i">>().toEqualTypeOf<number>();
expectTypeOf<DBusType<"x">>().toEqualTypeOf<bigint>();
expectTypeOf<DBusType<"t">>().toEqualTypeOf<bigint>();
expectTypeOf<DBusType<"d">>().toEqualTypeOf<number>();
expectTypeOf<DBusType<"o">>().toEqualTypeOf<string>();
expectTypeOf<DBusType<"g">>().toEqualTypeOf<string>();

expectTypeOf<DBusType<"v">>().toEqualTypeOf<DbusVar<unknown>>();

expectTypeOf<DBusType<"(is)">>().toEqualTypeOf<[number, string]>();
expectTypeOf<DBusType<"(i(is))">>().toEqualTypeOf<[number, [number, string]]>();
expectTypeOf<DBusType<"(i(is)(s))">>().toEqualTypeOf<
	[number, [number, string], [string]]
>();
expectTypeOf<DBusType<"((i((is)))s)">>().toEqualTypeOf<
	[[number, [[number, string]]], string]
>();

expectTypeOf<DBusType<"as">>().toEqualTypeOf<string[]>();
expectTypeOf<DBusType<"a(is)">>().toEqualTypeOf<[number, string][]>();
expectTypeOf<DBusType<"a(i(is))">>().toEqualTypeOf<
	[number, [number, string]][]
>();

expectTypeOf<DBusType<"a{sv}">>().toEqualTypeOf<
	Record<string, DbusVar<unknown>>
>();
expectTypeOf<DBusType<"a{is}">>().toEqualTypeOf<DbusDict<number, string>>();
expectTypeOf<DBusType<"a{xv}">>().toEqualTypeOf<
	DbusDict<bigint, DbusVar<unknown>>
>();

expectTypeOf<DBusType<"a{sa{sv}}">>().toEqualTypeOf<
	Record<string, Record<string, DbusVar<unknown>>>
>();
expectTypeOf<DBusType<"a{ia{sv}}">>().toEqualTypeOf<
	DbusDict<number, Record<string, DbusVar<unknown>>>
>();

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

type VarU = DbusVar<string>;
expectTypeOf<DBusType<"v">>().toEqualTypeOf<DbusVar<string>>();
expectTypeOf<DbusVar<"s">>().toEqualTypeOf<{ signature: "s"; value: string }>();
const var1: VarU = { signature: "s", value: "hello" };
const var2 = var1 as DbusVar<"s">;
expectTypeOf(var2).toEqualTypeOf<{ signature: "s"; value: string }>();
const var3 = var1 as DbusVar<"i">;
expectTypeOf(var3).toEqualTypeOf<{ signature: "i"; value: number }>();

expectTypeOf<DBusType<"(is)">>().toEqualTypeOf<[number, string]>();
expectTypeOf<DBusType<"(i(is))">>().toEqualTypeOf<[number, [number, string]]>();
expectTypeOf<DBusType<"(i(is)(s))">>().toEqualTypeOf<
	[number, [number, string], [string]]
>();
expectTypeOf<DBusType<"((i((is)))s)">>().toEqualTypeOf<
	[[number, [[number, string]]], string]
>();

expectTypeOf<DBusType<"as">>().toEqualTypeOf<Array<string>>();
expectTypeOf<DBusType<"a(is)">>().toEqualTypeOf<Array<[number, string]>>();
expectTypeOf<DBusType<"a(i(is))">>().toEqualTypeOf<
	Array<[number, [number, string]]>
>();

expectTypeOf<DBusType<"a{sv}">>().toEqualTypeOf<DbusDict<string, VarU>>();
expectTypeOf<DBusType<"a{is}">>().toEqualTypeOf<DbusDict<number, string>>();
expectTypeOf<DBusType<"a{xv}">>().toEqualTypeOf<DbusDict<bigint, VarU>>();

expectTypeOf<DBusType<"a{sa{sv}}">>().toEqualTypeOf<
	DbusDict<string, DbusDict<string, VarU>>
>();
expectTypeOf<DBusType<"a{ia{sv}}">>().toEqualTypeOf<
	DbusDict<number, DbusDict<string, VarU>>
>();

expectTypeOf<DBusType<"(isa{sv})">>().toEqualTypeOf<
	[number, string, DbusDict<string, VarU>]
>();
expectTypeOf<DBusType<"a(a{sv})">>().toEqualTypeOf<
	Array<[DbusDict<string, VarU>]>
>();
expectTypeOf<DBusType<"a{s(sib)}">>().toEqualTypeOf<
	DbusDict<string, [string, number, boolean]>
>();

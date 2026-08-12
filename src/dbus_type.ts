/** D-Bus 字典类型，表示为键值对数组 */
export type DbusDict<K, V> = [K, V][];
/** D-Bus variant 类型，包含签名和对应的值 */
export type DbusVar<T extends string> = {
	/** D-Bus 类型签名 */
	signature: T;
	/** 签名对应的值 */
	value: DBusType<T>;
};

/** D-Bus 基本类型到 TypeScript 类型的映射 */
interface DBusBasicMap {
	/** BYTE (y) - 无符号8位整数 */
	y: number;
	/** BOOLEAN (b) - 布尔值 */
	b: boolean;
	/** INT16 (n) - 有符号16位整数 */
	n: number;
	/** UINT16 (q) - 无符号16位整数 */
	q: number;
	/** INT32 (i) - 有符号32位整数 */
	i: number;
	/** UINT32 (u) - 无符号32位整数 */
	u: number;
	/** INT64 (x) - 有符号64位整数 */
	x: bigint;
	/** UINT64 (t) - 无符号64位整数 */
	t: bigint;
	/** DOUBLE (d) - 双精度浮点数 */
	d: number;
	/** STRING (s) - UTF-8 字符串 */
	s: string;
	/** OBJECT_PATH (o) - D-Bus 对象路径 */
	o: string;
	/** SIGNATURE (g) - D-Bus 类型签名 */
	g: string;
}

/** 解析 D-Bus 类型签名字符串，返回 [解析出的类型, 剩余签名] */
type ParseNext<S extends string> = S extends ""
	? never
	: S extends `v${infer Rest}`
		? [DbusVar<string>, Rest]
		: S extends `a{${infer Rest}`
			? ParseDictEntry<Rest> extends [infer K, infer V, infer DictRest]
				? [DbusDict<K, V>, DictRest]
				: never
			: S extends `a${infer Rest}`
				? ParseNext<Rest> extends [infer ArrType, infer ArrRest]
					? [Array<ArrType>, ArrRest]
					: never
				: S extends `(${infer Rest}`
					? ParseStructItems<Rest> extends [infer TupleType, infer TupleRest]
						? [TupleType, TupleRest]
						: never
					: S extends `${infer C}${infer Rest}`
						? C extends keyof DBusBasicMap
							? [DBusBasicMap[C], Rest]
							: never
						: never;

/** 解析结构体内部的类型列表，直到遇到 ')' */
type ParseStructItems<
	S extends string,
	Acc extends unknown[] = [],
> = S extends `)${infer Rest}`
	? [Acc, Rest]
	: ParseNext<S> extends [infer ItemType, infer Rest extends string]
		? ParseStructItems<Rest, [...Acc, ItemType]>
		: never;

/** 解析字典条目 {KV}，返回 [键类型, 值类型, 剩余签名] */
type ParseDictEntry<S extends string> = S extends `${infer K}${infer Rest}`
	? K extends keyof DBusBasicMap
		? ParseNext<Rest> extends [infer V, infer Rest2 extends string]
			? Rest2 extends `}${infer Rest3}`
				? [DBusBasicMap[K], V, Rest3]
				: never
			: never
		: never
	: never;

/** 将 D-Bus 类型签名字符串解析为对应的 TypeScript 类型 */
export type DBusType<T extends string> =
	ParseNext<T> extends [infer Type, ""] ? Type : never;

/** 将多个 D-Bus 类型签名解析为元组类型，如 "is" -> [number, string] */
export type DBusTypes<T extends string> = DBusType<`(${T})`>;

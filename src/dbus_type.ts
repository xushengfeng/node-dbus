// ==================== 自定义容器类型 ====================
export type DbusDict<K, V> = Map<K, V>;
export type DbusVar<T = unknown> = T;

// ==================== 类型映射核心 ====================
interface DBusBasicMap {
	y: number;
	b: boolean;
	n: number;
	q: number;
	i: number;
	u: number;
	x: bigint;
	t: bigint;
	d: number;
	s: string;
	o: string;
	g: string;
}

type IsDictSig<S extends string> = S extends `a{${string}}` ? true : false;

type Append<S extends string, C extends string> = `${S}${C}`;

// 逐字符消耗大括号，Body 为大括号内的完整内容
type ParseDict<S extends string, Depth extends unknown[], Body extends string = ""> =
	S extends `${infer C}${infer Rest}`
		? C extends "{"
			? ParseDict<Rest, [unknown, ...Depth], Append<Body, C>>
			: C extends "}"
				? Depth extends [unknown]
					? ParseDictBody<Body>
					: Depth extends [unknown, ...infer D]
						? ParseDict<Rest, D, Append<Body, C>>
						: never
				: ParseDict<Rest, Depth, Append<Body, C>>
		: never;

// 解析一个完整的类型签名（不含剩余部分）
type ParseOne<S extends string> =
	S extends `v` ? DbusVar<unknown> :
	IsDictSig<S> extends true
		? S extends `a{${infer Rest}` ? ParseDict<Rest, [unknown]> : never
		: S extends `a${infer Inner}` ? Array<ParseArrayItem<Inner>>
			: S extends `(${infer Body})` ? ParseStruct<Body>
				: S extends keyof DBusBasicMap ? DBusBasicMap[S]
					: never;

// 数组元素类型（不处理数组本身，避免无限递归）
type ParseArrayItem<S extends string> =
	S extends `v` ? DbusVar<unknown> :
	IsDictSig<S> extends true
		? S extends `a{${infer Rest}` ? ParseDict<Rest, [unknown]> : never
		: S extends `(${infer Body})` ? ParseStruct<Body>
			: S extends keyof DBusBasicMap ? DBusBasicMap[S]
				: never;

// 解析结构体内部的一系列类型
type ParseStruct<S extends string> =
	S extends `${infer First}${infer Rest}`
		? First extends keyof DBusBasicMap
			? [DBusBasicMap[First], ...ParseStruct<Rest>]
			: First extends "("
				? ParseNestedStruct<Rest, []>
				: never
		: [];

// 解析嵌套结构体（遇到右括号结束）
type ParseNestedStruct<S extends string, Acc extends unknown[]> =
	S extends `${infer First}${infer Rest}`
		? First extends ")"
			? [Acc, ...ParseStruct<Rest>]
			: First extends keyof DBusBasicMap
				? ParseNestedStruct<Rest, [...Acc, DBusBasicMap[First]]>
				: First extends "("
					? ParseNestedStructInner<Rest, [], Acc>
					: never
		: never;

type ParseNestedStructInner<S extends string, InnerAcc extends unknown[], OuterAcc extends unknown[]> =
	S extends `${infer First}${infer Rest}`
		? First extends ")"
			? ParseNestedStruct<Rest, [...OuterAcc, InnerAcc]>
			: First extends keyof DBusBasicMap
				? ParseNestedStructInner<Rest, [...InnerAcc, DBusBasicMap[First]], OuterAcc>
				: First extends "("
					? ParseNestedStructInner2<Rest, [], InnerAcc, OuterAcc>
					: never
		: never;

type ParseNestedStructInner2<S extends string, Acc2 extends unknown[], InnerAcc extends unknown[], OuterAcc extends unknown[]> =
	S extends `${infer First}${infer Rest}`
		? First extends ")"
			? ParseNestedStructInner<Rest, [...InnerAcc, Acc2], OuterAcc>
			: First extends keyof DBusBasicMap
				? ParseNestedStructInner2<Rest, [...Acc2, DBusBasicMap[First]], InnerAcc, OuterAcc>
				: never
		: never;

// 解析字典体（Key + ValueType，ValueType 可为任意完整类型）
type ParseDictBody<S extends string> =
	S extends `${infer K}${infer ValBody}`
		? K extends keyof DBusBasicMap
			? ParseOne<ValBody> extends infer Val
				? DBusBasicMap[K] extends string
					? Record<string, Val>
					: DbusDict<DBusBasicMap[K], Val>
				: never
			: never
		: never;

export type DBusType<T extends string> = ParseOne<T>;

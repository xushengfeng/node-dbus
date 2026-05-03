// ==================== 自定义容器类型 ====================
export type DbusDict<K, V> = [K, V];
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

type ParseNext<S extends string> = S extends ""
	? never
	: S extends `v${infer Rest}`
		? [DbusVar<unknown>, Rest]
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

type ParseStructItems<
	S extends string,
	Acc extends unknown[] = [],
> = S extends `)${infer Rest}`
	? [Acc, Rest]
	: ParseNext<S> extends [infer ItemType, infer Rest extends string]
		? ParseStructItems<Rest, [...Acc, ItemType]>
		: never;

type ParseDictEntry<S extends string> = S extends `${infer K}${infer Rest}`
	? K extends keyof DBusBasicMap
		? ParseNext<Rest> extends [infer V, infer Rest2 extends string]
			? Rest2 extends `}${infer Rest3}`
				? [DBusBasicMap[K], V, Rest3]
				: never
			: never
		: never
	: never;

export type DBusType<T extends string> =
	ParseNext<T> extends [infer Type, ""] ? Type : never;

/** D-Bus 字节序标记 */
export const Endian = {
	/** 小端序 'l' (0x6c) */
	Little: 0x6c, // 'l'
	/** 大端序 'B' (0x42) */
	Big: 0x42, // 'B'
} as const;
/** D-Bus 字节序类型 */
export type Endian = (typeof Endian)[keyof typeof Endian];

/** D-Bus 消息类型 */
export const MessageType = {
	/** 方法调用 */
	MethodCall: 1,
	/** 方法返回 */
	MethodReturn: 2,
	/** 错误 */
	Error: 3,
	/** 信号 */
	Signal: 4,
} as const;
/** D-Bus 消息类型 */
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

/** D-Bus 消息头字段代码 */
export const HeaderFieldCode = {
	/** 对象路径 */
	Path: 1,
	/** 接口名 */
	Interface: 2,
	/** 成员名（方法/信号） */
	Member: 3,
	/** 错误名 */
	ErrorName: 4,
	/** 回复序列号 */
	ReplySerial: 5,
	/** 目标总线名 */
	Destination: 6,
	/** 发送者总线名 */
	Sender: 7,
	/** 类型签名 */
	Signature: 8,
	/** Unix 文件描述符数量 */
	UnixFds: 9,
} as const;
/** D-Bus 消息头字段代码类型 */
export type HeaderFieldCode =
	(typeof HeaderFieldCode)[keyof typeof HeaderFieldCode];

/** D-Bus 消息头字段 */
export interface HeaderField {
	/** 字段代码 */
	code: HeaderFieldCode;
	/** 字段值 */
	value: unknown;
}

/** D-Bus 消息头 */
export interface MessageHeader {
	/** 字节序 */
	endian: Endian;
	/** 消息类型 */
	type: MessageType;
	/** 消息标志 */
	flags: number;
	/** 协议版本 */
	version: number;
	/** 消息体长度（字节） */
	bodyLength: number;
	/** 消息序列号 */
	serial: number;
	/** 头字段列表 */
	fields: HeaderField[];
}

/** D-Bus 消息结构 */
export interface Message {
	/** 消息头 */
	header: MessageHeader;
	/** 消息体 */
	body: unknown[];
}

/**
 * 计算对齐填充字节数
 * @param offset - 当前偏移量
 * @param alignment - 对齐边界
 * @returns 需要的填充字节数
 */
export function align(offset: number, alignment: number): number {
	const remainder = offset % alignment;
	return remainder === 0 ? 0 : alignment - remainder;
}

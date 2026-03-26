export const Endian = {
	Little: 0x6c, // 'l'
	Big: 0x42, // 'B'
} as const;
export type Endian = (typeof Endian)[keyof typeof Endian];

export const MessageType = {
	MethodCall: 1,
	MethodReturn: 2,
	Error: 3,
	Signal: 4,
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const HeaderFieldCode = {
	Path: 1,
	Interface: 2,
	Member: 3,
	ErrorName: 4,
	ReplySerial: 5,
	Destination: 6,
	Sender: 7,
	Signature: 8,
	UnixFds: 9,
} as const;
export type HeaderFieldCode =
	(typeof HeaderFieldCode)[keyof typeof HeaderFieldCode];

export interface HeaderField {
	code: HeaderFieldCode;
	value: unknown;
}

export interface MessageHeader {
	endian: Endian;
	type: MessageType;
	flags: number;
	version: number;
	bodyLength: number;
	serial: number;
	fields: HeaderField[];
}

export interface Message {
	header: MessageHeader;
	body: unknown[];
}

export function align(offset: number, alignment: number): number {
	const remainder = offset % alignment;
	return remainder === 0 ? 0 : alignment - remainder;
}

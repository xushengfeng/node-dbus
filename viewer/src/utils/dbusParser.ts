import type { DbusMessage } from '../types/dbus'

const Endian = {
  Little: 0x6c,
  Big: 0x42,
} as const

const MessageType = {
  MethodCall: 1,
  MethodReturn: 2,
  Error: 3,
  Signal: 4,
} as const

const HeaderFieldCode = {
  Path: 1,
  Interface: 2,
  Member: 3,
  ErrorName: 4,
  ReplySerial: 5,
  Destination: 6,
  Sender: 7,
  Signature: 8,
  UnixFds: 9,
} as const

function align(offset: number, alignment: number): number {
  const remainder = offset % alignment
  return remainder === 0 ? 0 : alignment - remainder
}

function getAlignment(sig: string): number {
  if (sig.startsWith('a')) return 4
  switch (sig[0]) {
    case 'y':
    case 'g':
    case 'v':
      return 1
    case 'n':
    case 'q':
      return 2
    case 'b':
    case 'i':
    case 'u':
    case 's':
    case 'o':
      return 4
    case 'x':
    case 't':
    case 'd':
    case 'r':
    case '{':
    case '(':
      return 8
    default:
      return 1
  }
}

function splitSignature(sig: string): string[] {
  const result: string[] = []
  let i = 0
  while (i < sig.length) {
    let start = i
    if (sig[i] === 'a') {
      while (sig[i] === 'a') {
        i++
      }
      if (sig[i] === '{' || sig[i] === '(') {
        let depth = 0
        const startChar = sig[i]
        const endChar = startChar === '{' ? '}' : ')'
        for (let k = i; k < sig.length; k++) {
          if (sig[k] === startChar) depth++
          else if (sig[k] === endChar) depth--
          if (depth === 0) {
            i = k + 1
            result.push(sig.substring(start, i))
            break
          }
        }
      } else {
        result.push(sig.substring(start, i + 1))
        i++
      }
    } else if (sig[i] === '{' || sig[i] === '(') {
      let depth = 0
      const startChar = sig[i]
      const endChar = startChar === '{' ? '}' : ')'
      for (let k = i; k < sig.length; k++) {
        if (sig[k] === startChar) depth++
        else if (sig[k] === endChar) depth--
        if (depth === 0) {
          result.push(sig.substring(i, k + 1))
          i = k + 1
          break
        }
      }
    } else {
      result.push(sig[i])
      i++
    }
  }
  return result
}

class Decoder {
  private view: DataView
  private offset: number
  private endian: number

  constructor(data: Uint8Array, endian: number = Endian.Little) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    this.offset = 0
    this.endian = endian
  }

  get position(): number {
    return this.offset
  }

  set position(value: number) {
    this.offset = value
  }

  readByte(): number {
    const value = this.view.getUint8(this.offset)
    this.offset += 1
    return value
  }

  readUint32(): number {
    this.offset += align(this.offset, 4)
    const value =
      this.endian === Endian.Little
        ? this.view.getUint32(this.offset, true)
        : this.view.getUint32(this.offset, false)
    this.offset += 4
    return value
  }

  readInt32(): number {
    this.offset += align(this.offset, 4)
    const value =
      this.endian === Endian.Little
        ? this.view.getInt32(this.offset, true)
        : this.view.getInt32(this.offset, false)
    this.offset += 4
    return value
  }

  readUint16(): number {
    this.offset += align(this.offset, 2)
    const value =
      this.endian === Endian.Little
        ? this.view.getUint16(this.offset, true)
        : this.view.getUint16(this.offset, false)
    this.offset += 2
    return value
  }

  readInt16(): number {
    this.offset += align(this.offset, 2)
    const value =
      this.endian === Endian.Little
        ? this.view.getInt16(this.offset, true)
        : this.view.getInt16(this.offset, false)
    this.offset += 2
    return value
  }

  readUint64(): number {
    this.offset += align(this.offset, 8)
    const value =
      this.endian === Endian.Little
        ? Number(this.view.getBigUint64(this.offset, true))
        : Number(this.view.getBigUint64(this.offset, false))
    this.offset += 8
    return value
  }

  readInt64(): number {
    this.offset += align(this.offset, 8)
    const value =
      this.endian === Endian.Little
        ? Number(this.view.getBigInt64(this.offset, true))
        : Number(this.view.getBigInt64(this.offset, false))
    this.offset += 8
    return value
  }

  readDouble(): number {
    this.offset += align(this.offset, 8)
    const value =
      this.endian === Endian.Little
        ? this.view.getFloat64(this.offset, true)
        : this.view.getFloat64(this.offset, false)
    this.offset += 8
    return value
  }

  readBoolean(): boolean {
    return this.readUint32() !== 0
  }

  readSignature(): string {
    const length = this.view.getUint8(this.offset)
    this.offset += 1
    const value = new TextDecoder('utf-8').decode(
      new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length)
    )
    this.offset += length + 1
    return value
  }

  readString(): string {
    const length = this.readUint32()
    const value = new TextDecoder('utf-8').decode(
      new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length)
    )
    this.offset += length + 1
    return value
  }

  readObjectPath(): string {
    return this.readString()
  }

  readVariant(): { value: unknown[]; signature: string } {
    const signature = this.readSignature()
    const value = []
    for (const sigPart of splitSignature(signature)) {
      value.push(this.readValue(sigPart))
    }
    return { value, signature }
  }

  readValue(signature: string): unknown {
    switch (signature) {
      case 'y':
        return this.readByte()
      case 'n':
        return this.readInt16()
      case 'q':
        return this.readUint16()
      case 'i':
        return this.readInt32()
      case 'u':
        return this.readUint32()
      case 'x':
        return this.readInt64()
      case 't':
        return this.readUint64()
      case 'd':
        return this.readDouble()
      case 'b':
        return this.readBoolean()
      case 's':
        return this.readString()
      case 'o':
        return this.readObjectPath()
      case 'g':
        return this.readSignature()
      case 'v':
        return this.readVariant()
      default:
        if (signature.startsWith('a')) {
          const elemSig = signature.substring(1)
          const length = this.readUint32()
          this.offset += align(this.offset, getAlignment(elemSig))

          const startOffset = this.offset
          const arr: unknown[] = []
          if (elemSig === '') return arr
          if (length === 0) return arr
          while (this.offset - startOffset < length) {
            arr.push(this.readValue(elemSig))
          }
          this.offset = startOffset + length
          return arr
        } else if (signature.startsWith('(') && signature.endsWith(')')) {
          this.offset += align(this.offset, 8)
          const fields = splitSignature(signature.substring(1, signature.length - 1))
          const arr: unknown[] = []
          for (let i = 0; i < fields.length; i++) {
            arr.push(this.readValue(fields[i]))
          }
          return arr
        } else if (signature.startsWith('{') && signature.endsWith('}')) {
          this.offset += align(this.offset, 8)
          const fields = splitSignature(signature.substring(1, signature.length - 1))
          const arr: unknown[] = []
          for (let i = 0; i < fields.length; i++) {
            arr.push(this.readValue(fields[i]))
          }
          return arr
        }
        throw new Error(`Unsupported signature: ${signature}`)
    }
  }
}

function decodeMessage(data: Uint8Array): {
  message: {
    header: {
      endian: number
      type: number
      flags: number
      version: number
      bodyLength: number
      serial: number
      fields: Array<{ code: number; value: unknown }>
    }
    body: unknown[]
  }
  consumed: number
} {
  const decoder = new Decoder(data)
  const endian = decoder.readByte()
  const type = decoder.readByte()
  const flags = decoder.readByte()
  const version = decoder.readByte()
  const bodyLength = decoder.readUint32()
  const serial = decoder.readUint32()

  const fieldsLength = decoder.readUint32()
  const fieldsStart = decoder.position

  const fields: Array<{ code: number; value: unknown }> = []
  while (decoder.position - fieldsStart < fieldsLength) {
    decoder.position += align(decoder.position, 8)
    const code = decoder.readByte()
    const variant = decoder.readVariant()
    fields.push({ code, value: variant.value[0] })
  }

  decoder.position = fieldsStart + fieldsLength
  decoder.position += align(decoder.position, 8)

  const signature =
    (fields.find((f) => f.code === HeaderFieldCode.Signature)?.value as string) ?? ''
  const body: unknown[] = []

  if (bodyLength > 0) {
    const bodyStart = decoder.position
    const sigParts = splitSignature(signature)
    for (let i = 0; i < sigParts.length; i++) {
      body.push(decoder.readValue(sigParts[i]))
    }
    decoder.position = bodyStart + bodyLength
  }

  return {
    message: {
      header: { endian, type, flags, version, bodyLength, serial, fields },
      body,
    },
    consumed: decoder.position,
  }
}

function getMessageTypeString(type: number): 'MethodCall' | 'MethodReturn' | 'Error' | 'Signal' {
  switch (type) {
    case MessageType.MethodCall:
      return 'MethodCall'
    case MessageType.MethodReturn:
      return 'MethodReturn'
    case MessageType.Error:
      return 'Error'
    case MessageType.Signal:
      return 'Signal'
    default:
      return 'MethodCall'
  }
}

function getFieldStringValue(fields: Array<{ code: number; value: unknown }>, code: number): string | undefined {
  const field = fields.find((f) => f.code === code)
  return field?.value as string | undefined
}

function getFieldNumberValue(fields: Array<{ code: number; value: unknown }>, code: number): number | undefined {
  const field = fields.find((f) => f.code === code)
  return field?.value as number | undefined
}

export function parseDbusMessage(data: Uint8Array, timestamp: number, source: string, destination: string): DbusMessage | null {
  try {
    const { message } = decodeMessage(data)
    const fields = message.header.fields

    const sender = getFieldStringValue(fields, HeaderFieldCode.Sender) ?? source
    const dest = getFieldStringValue(fields, HeaderFieldCode.Destination) ?? destination

    return {
      timestamp,
      source: sender,
      destination: dest,
      type: getMessageTypeString(message.header.type),
      path: getFieldStringValue(fields, HeaderFieldCode.Path),
      interface: getFieldStringValue(fields, HeaderFieldCode.Interface),
      member: getFieldStringValue(fields, HeaderFieldCode.Member),
      sender: sender,
      errorName: getFieldStringValue(fields, HeaderFieldCode.ErrorName),
      serial: message.header.serial,
      replySerial: getFieldNumberValue(fields, HeaderFieldCode.ReplySerial),
      signature: getFieldStringValue(fields, HeaderFieldCode.Signature),
      body: message.body,
      raw: message,
    }
  } catch (error) {
    console.error('Failed to parse dbus message:', error)
    return null
  }
}
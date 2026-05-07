export interface DbusMessage {
  timestamp: number
  source: string
  destination: string
  type: 'MethodCall' | 'MethodReturn' | 'Error' | 'Signal'
  path?: string
  interface?: string
  member?: string
  sender?: string
  errorName?: string
  serial: number
  replySerial?: number
  signature?: string
  body?: unknown[]
  raw: {
    header: {
      endian: number
      type: number
      flags: number
      version: number
      bodyLength: number
      serial: number
      fields: Array<{
        code: number
        value: unknown
      }>
    }
    body: unknown[]
  }
}
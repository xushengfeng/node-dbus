import { describe, it, expect } from 'vitest'
import { parseDbusMessage } from '../utils/dbusParser'
import { extractDbusMessagesFromPcap } from '../utils/pcapDbusExtractor'
import fs from 'fs'
import path from 'path'

function loadTestPcap(): Uint8Array {
  const pcapPath = path.join(__dirname, '../../2026-05-06 17:51:08.pcapng')
  const pcapData = fs.readFileSync(pcapPath)
  return new Uint8Array(pcapData)
}

describe('dbusParser', () => {
  it('should parse a simple dbus message header', () => {
    const data = new Uint8Array([
      0x6c, // 小端序
      0x01, // MethodCall
      0x00, // flags
      0x01, // version
      0x00, 0x00, 0x00, 0x00, // body length
      0x01, 0x00, 0x00, 0x00, // serial
      0x00, 0x00, 0x00, 0x00, // fields length (0)
    ])

    const message = parseDbusMessage(data, 1000.0, 'source', 'destination')

    expect(message).not.toBeNull()
    expect(message!.type).toBe('MethodCall')
    expect(message!.serial).toBe(1)
    expect(message!.timestamp).toBe(1000.0)
    expect(message!.source).toBe('source')
    expect(message!.destination).toBe('destination')
  })

  it('should return null for invalid dbus message', () => {
    const data = new Uint8Array([1, 2, 3])
    const message = parseDbusMessage(data, 1000.0, 'source', 'destination')
    expect(message).toBeNull()
  })

  it('should parse messages from the example pcap file', () => {
    const pcapData = loadTestPcap()
    const messages = extractDbusMessagesFromPcap(pcapData)

    expect(messages.length).toBeGreaterThan(0)

    const first = messages[0]
    expect(first.type).toBeDefined()
    expect(first.serial).toBeDefined()
    expect(first.timestamp).toBeGreaterThan(0)
    expect(first.raw).toBeDefined()
    expect(first.raw.header).toBeDefined()
  })

  it('should parse Signal messages from pcap', () => {
    const pcapData = loadTestPcap()
    const messages = extractDbusMessagesFromPcap(pcapData)

    const signals = messages.filter(m => m.type === 'Signal')
    expect(signals.length).toBeGreaterThan(0)

    const firstSignal = signals[0]
    expect(firstSignal.path).toBeDefined()
    expect(firstSignal.interface).toBeDefined()
    expect(firstSignal.member).toBeDefined()
    expect(firstSignal.signature).toBeDefined()
  })

  it('should parse MethodCall messages from pcap', () => {
    const pcapData = loadTestPcap()
    const messages = extractDbusMessagesFromPcap(pcapData)

    const calls = messages.filter(m => m.type === 'MethodCall')
    if (calls.length > 0) {
      const call = calls[0]
      expect(call.path).toBeDefined()
      expect(call.interface).toBeDefined()
      expect(call.member).toBeDefined()
    }
  })

  it('should have correct dbus header fields in raw data', () => {
    const pcapData = loadTestPcap()
    const messages = extractDbusMessagesFromPcap(pcapData)

    for (const msg of messages) {
      expect(msg.raw.header.endian).toBe(0x6c) // little endian
      expect(msg.raw.header.version).toBe(1)
      expect([1, 2, 3, 4]).toContain(msg.raw.header.type)
    }
  })
})

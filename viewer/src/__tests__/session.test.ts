import { describe, it, expect } from 'vitest'
import { extractDbusMessagesFromPcap } from '../utils/pcapDbusExtractor'
import fs from 'fs'
import path from 'path'

function loadSessionPcap(): Uint8Array {
  const p = path.join(__dirname, '../../session.pcap')
  return new Uint8Array(fs.readFileSync(p))
}

describe('session.pcap parsing', () => {
  it('should parse session.pcap with correct sender/destination', () => {
    const data = loadSessionPcap()
    const messages = extractDbusMessagesFromPcap(data)

    expect(messages.length).toBeGreaterThan(0)
    console.log(`Parsed ${messages.length} messages from session.pcap`)

    const first = messages[0]
    expect(first.sender).toBeDefined()
    expect(first.sender!.length).toBeGreaterThan(0)
  })

  it('should have all 4 message types', () => {
    const messages = extractDbusMessagesFromPcap(loadSessionPcap())
    const types = new Set(messages.map(m => m.type))
    expect(types.has('Signal')).toBe(true)
    expect(types.has('MethodCall')).toBe(true)
    console.log('Types:', [...types], 'Count:', messages.length)
  })

  it('should extract unique participants (senders)', () => {
    const messages = extractDbusMessagesFromPcap(loadSessionPcap())
    const senders = new Set(messages.map(m => m.sender).filter(Boolean))

    console.log('Senders:', [...senders])

    expect(senders.size).toBeGreaterThan(0)
  })

  it('should have destinations for MethodCall messages', () => {
    const messages = extractDbusMessagesFromPcap(loadSessionPcap())
    const calls = messages.filter(m => m.type === 'MethodCall')

    console.log('MethodCall count:', calls.length)
    for (const c of calls.slice(0, 5)) {
      console.log(`  ${c.sender} -> ${c.destination} :: ${c.member || c.interface}`)
    }

    const withDest = calls.filter(c => c.destination && c.destination.length > 0)
    expect(withDest.length).toBeGreaterThan(0)
  })

  it('should parse all messages successfully', () => {
    const messages = extractDbusMessagesFromPcap(loadSessionPcap())
    for (const msg of messages) {
      expect(msg.type).toBeDefined()
      expect(msg.timestamp).toBeGreaterThan(0)
      expect(msg.raw).toBeDefined()
      expect(msg.raw.header.fields).toBeDefined()
    }
  })
})

import { describe, it, expect } from 'vitest'
import { extractDbusMessagesFromPcap } from '../utils/pcapDbusExtractor'
import fs from 'fs'
import path from 'path'

function loadTestPcap(): Uint8Array {
  const pcapPath = path.join(__dirname, '../../2026-05-06 17:51:08.pcapng')
  const pcapData = fs.readFileSync(pcapPath)
  return new Uint8Array(pcapData)
}

describe('pcapng file parsing', () => {
  it('should parse the example pcapng file', () => {
    const pcapData = loadTestPcap()
    const messages = extractDbusMessagesFromPcap(pcapData)
    
    // 验证解析结果
    expect(messages.length).toBeGreaterThan(0)
    
    // 检查第一个消息
    const firstMessage = messages[0]
    expect(firstMessage).toBeDefined()
    expect(firstMessage.type).toBeDefined()
    expect(firstMessage.serial).toBeDefined()
    expect(firstMessage.timestamp).toBeDefined()
    
    console.log(`Parsed ${messages.length} dbus messages`)
    console.log('First message:', JSON.stringify(firstMessage, null, 2))
  })
  
  it('should parse pcap file with direct dbus messages', () => {
    // 创建一个简单的 pcap 文件，包含直接 dbus 消息（链路层类型 231）
    const data = new Uint8Array([
      // 全局头（小端序）
      0xd4, 0xc3, 0xb2, 0xa1, // 魔数（小端序字节序）
      0x02, 0x00, // 版本主版本号
      0x04, 0x00, // 版本次版本号
      0x00, 0x00, 0x00, 0x00, // 时区偏移
      0x00, 0x00, 0x00, 0x00, // 时间戳精度
      0xff, 0xff, 0x00, 0x00, // 快照长度
      0xe7, 0x00, 0x00, 0x00, // 链路层类型（231 = Linux cooked）
      
      // 包头
      0x00, 0x00, 0x00, 0x00, // 时间戳秒
      0x00, 0x00, 0x00, 0x00, // 时间戳微秒
      0x10, 0x00, 0x00, 0x00, // 包含长度（16 字节）
      0x10, 0x00, 0x00, 0x00, // 原始长度
      
      // 包数据（一个简单的 dbus 消息）
      0x6c, // 小端序
      0x01, // MethodCall
      0x00, // flags
      0x01, // version
      0x00, 0x00, 0x00, 0x00, // body length
      0x01, 0x00, 0x00, 0x00, // serial
      0x00, 0x00, 0x00, 0x00, // fields length
    ])
    
    const messages = extractDbusMessagesFromPcap(data)
    
    expect(messages).toHaveLength(1)
    expect(messages[0].type).toBe('MethodCall')
    expect(messages[0].serial).toBe(1)
  })
  
  it('should have all message types in example file', () => {
    const pcapData = loadTestPcap()
    const messages = extractDbusMessagesFromPcap(pcapData)
    
    const types = new Set(messages.map(m => m.type))
    expect(types.has('Signal')).toBe(true)
    
    console.log('Message types found:', [...types])
    console.log('Total messages:', messages.length)
    
    // 每条消息应该有 raw 数据
    for (const msg of messages) {
      expect(msg.raw.header.fields).toBeDefined()
      expect(Array.isArray(msg.raw.header.fields)).toBe(true)
    }
  })
  
  it('should extract sender from messages', () => {
    const pcapData = loadTestPcap()
    const messages = extractDbusMessagesFromPcap(pcapData)
    
    const withSender = messages.filter(m => m.sender)
    expect(withSender.length).toBeGreaterThan(0)
    
    // 验证第一条有 sender 的消息
    const msg = withSender[0]
    expect(typeof msg.sender).toBe('string')
    expect(msg.sender!.length).toBeGreaterThan(0)
  })
})
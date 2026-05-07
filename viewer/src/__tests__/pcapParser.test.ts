import { describe, it, expect } from 'vitest'
import { parsePcap } from '../utils/pcapParser'

describe('pcapParser', () => {
  it('should parse a valid pcap file header', () => {
    // 创建一个最小的 pcap 文件（只有全局头）
    const data = new Uint8Array(24)
    const view = new DataView(data.buffer)
    
    // 魔数 (little endian)
    view.setUint32(0, 0xa1b2c3d4, true)
    // 版本
    view.setUint16(4, 2, true)
    view.setUint16(6, 4, true)
    // 时区
    view.setInt32(8, 0, true)
    // 时间戳精度
    view.setUint32(12, 0, true)
    // 快照长度
    view.setUint32(16, 65535, true)
    // 链路层类型
    view.setUint32(20, 1, true) // 1 = Ethernet
    
    const result = parsePcap(data)
    
    expect(result.globalHeader.magicNumber).toBe(0xa1b2c3d4)
    expect(result.globalHeader.versionMajor).toBe(2)
    expect(result.globalHeader.versionMinor).toBe(4)
    expect(result.globalHeader.network).toBe(1)
    expect(result.packets).toHaveLength(0)
  })
  
  it('should parse pcap packets', () => {
    // 创建一个包含一个空数据包的 pcap 文件
    const data = new Uint8Array(24 + 16) // 全局头 + 一个包头
    const view = new DataView(data.buffer)
    
    // 全局头
    view.setUint32(0, 0xa1b2c3d4, true)
    view.setUint16(4, 2, true)
    view.setUint16(6, 4, true)
    view.setInt32(8, 0, true)
    view.setUint32(12, 0, true)
    view.setUint32(16, 65535, true)
    view.setUint32(20, 1, true)
    
    // 包头
    const packetOffset = 24
    view.setUint32(packetOffset, 1000, true) // 时间戳秒
    view.setUint32(packetOffset + 4, 500000, true) // 时间戳微秒
    view.setUint32(packetOffset + 8, 0, true) // 包含长度
    view.setUint32(packetOffset + 12, 0, true) // 原始长度
    
    const result = parsePcap(data)
    
    expect(result.packets).toHaveLength(1)
    expect(result.packets[0].timestamp).toBe(1000.5)
    expect(result.packets[0].header.tsSec).toBe(1000)
    expect(result.packets[0].header.tsUsec).toBe(500000)
    expect(result.packets[0].header.inclLen).toBe(0)
    expect(result.packets[0].data).toHaveLength(0)
  })
  
  it('should parse pcap packet with data', () => {
    // 创建一个包含数据包的 pcap 文件
    const packetData = new Uint8Array([1, 2, 3, 4, 5])
    const data = new Uint8Array(24 + 16 + packetData.length)
    const view = new DataView(data.buffer)
    
    // 全局头
    view.setUint32(0, 0xa1b2c3d4, true)
    view.setUint16(4, 2, true)
    view.setUint16(6, 4, true)
    view.setInt32(8, 0, true)
    view.setUint32(12, 0, true)
    view.setUint32(16, 65535, true)
    view.setUint32(20, 1, true)
    
    // 包头
    const packetOffset = 24
    view.setUint32(packetOffset, 1000, true)
    view.setUint32(packetOffset + 4, 0, true)
    view.setUint32(packetOffset + 8, packetData.length, true)
    view.setUint32(packetOffset + 12, packetData.length, true)
    
    // 包数据
    data.set(packetData, packetOffset + 16)
    
    const result = parsePcap(data)
    
    expect(result.packets).toHaveLength(1)
    expect(result.packets[0].data).toEqual(packetData)
  })
  
  it('should handle big endian pcap files', () => {
    // 创建一个大端序的 pcap 文件
    const data = new Uint8Array(24)
    const view = new DataView(data.buffer)
    
    // 魔数 (big endian) - pcap 魔数在文件的原生字节序中始终是 0xa1b2c3d4
    // 大端序文件中字节为 a1 b2 c3 d4
    view.setUint32(0, 0xa1b2c3d4, false)
    // 版本
    view.setUint16(4, 2, false)
    view.setUint16(6, 4, false)
    // 时区
    view.setInt32(8, 0, false)
    // 时间戳精度
    view.setUint32(12, 0, false)
    // 快照长度
    view.setUint32(16, 65535, false)
    // 链路层类型
    view.setUint32(20, 1, false)
    
    const result = parsePcap(data)
    
    expect(result.globalHeader.magicNumber).toBe(0xa1b2c3d4)
    expect(result.globalHeader.versionMajor).toBe(2)
    expect(result.globalHeader.versionMinor).toBe(4)
    expect(result.globalHeader.network).toBe(1)
  })
  
  it('should throw error for invalid magic number', () => {
    const data = new Uint8Array(24)
    const view = new DataView(data.buffer)
    
    // 无效的魔数
    view.setUint32(0, 0x12345678, true)
    
    expect(() => parsePcap(data)).toThrow('Invalid pcap file: wrong magic number')
  })
})
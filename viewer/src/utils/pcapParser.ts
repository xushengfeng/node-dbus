export interface PcapGlobalHeader {
  magicNumber: number
  versionMajor: number
  versionMinor: number
  thiszone: number
  sigfigs: number
  snaplen: number
  network: number
}

export interface PcapPacketHeader {
  tsSec: number
  tsUsec: number
  inclLen: number
  origLen: number
}

export interface PcapPacket {
  header: PcapPacketHeader
  data: Uint8Array
  timestamp: number
}

export interface PcapFile {
  globalHeader: PcapGlobalHeader
  packets: PcapPacket[]
  linkType: number
}

export function parsePcap(data: Uint8Array): PcapFile {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  
  // pcap 魔数总是 0xa1b2c3d4，以文件的原生字节序存储
  // 如果以小端序读取得到 0xa1b2c3d4，则文件是小端序
  // 如果以大端序读取得到 0xa1b2c3d4，则文件是大端序
  const magicLE = view.getUint32(0, true)
  const magicBE = view.getUint32(0, false)
  
  let littleEndian: boolean
  let magicNumber: number
  
  if (magicLE === 0xa1b2c3d4) {
    littleEndian = true
    magicNumber = 0xa1b2c3d4
  } else if (magicBE === 0xa1b2c3d4) {
    littleEndian = false
    magicNumber = 0xa1b2c3d4
  } else {
    throw new Error(`Invalid pcap file: wrong magic number (0x${magicLE.toString(16)})`)
  }
  
  // 解析全局头
  const globalHeader: PcapGlobalHeader = {
    magicNumber: magicNumber,
    versionMajor: view.getUint16(4, littleEndian),
    versionMinor: view.getUint16(6, littleEndian),
    thiszone: view.getInt32(8, littleEndian),
    sigfigs: view.getUint32(12, littleEndian),
    snaplen: view.getUint32(16, littleEndian),
    network: view.getUint32(20, littleEndian)
  }
  
  const packets: PcapPacket[] = []
  let offset = 24 // 全局头大小
  
  while (offset < data.length) {
    if (offset + 16 > data.length) break
    
    // 解析包头
    const packetHeader: PcapPacketHeader = {
      tsSec: view.getUint32(offset, littleEndian),
      tsUsec: view.getUint32(offset + 4, littleEndian),
      inclLen: view.getUint32(offset + 8, littleEndian),
      origLen: view.getUint32(offset + 12, littleEndian)
    }
    
    offset += 16
    
    // 检查是否有足够的数据
    if (offset + packetHeader.inclLen > data.length) break
    
    // 提取包数据
    const packetData = data.slice(offset, offset + packetHeader.inclLen)
    
    // 计算时间戳（秒）
    const timestamp = packetHeader.tsSec + packetHeader.tsUsec / 1000000
    
    packets.push({
      header: packetHeader,
      data: packetData,
      timestamp
    })
    
    offset += packetHeader.inclLen
  }
  
  return {
    globalHeader,
    packets,
    linkType: globalHeader.network
  }
}
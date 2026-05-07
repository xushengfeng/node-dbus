import { parsePcap } from './pcapParser'
import { parseDbusMessage } from './dbusParser'
import type { DbusMessage } from '../types/dbus'

export function extractDbusMessagesFromPcap(pcapData: Uint8Array): DbusMessage[] {
  const pcap = parsePcap(pcapData)
  const messages: DbusMessage[] = []
  
  for (const packet of pcap.packets) {
    if (pcap.linkType === 231) {
      const dbusMessage = parseDbusMessage(packet.data, packet.timestamp, '', '')
      if (dbusMessage) {
        messages.push(dbusMessage)
      }
    }
  }
  
  messages.sort((a, b) => a.timestamp - b.timestamp)
  
  return messages
}

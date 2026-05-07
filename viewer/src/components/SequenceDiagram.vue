<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DbusMessage } from '../types/dbus'

const props = defineProps<{
  messages: DbusMessage[]
}>()

const emit = defineEmits<{
  (e: 'message-selected', message: DbusMessage): void
}>()

const selectedMessageIndex = ref<number | null>(null)

const participants = computed(() => {
  const set = new Set<string>()
  for (const msg of props.messages) {
    if (msg.sender) set.add(msg.sender)
    if (msg.destination) set.add(msg.destination)
  }
  return Array.from(set).sort()
})

const posMap = computed(() => {
  const m: Record<string, number> = {}
  const spacing = 180
  const startX = 80
  participants.value.forEach((p, i) => { m[p] = startX + i * spacing })
  return m
})

const rowH = 52
const headH = 60
const footH = 30

const svgW = computed(() => Math.max(600, participants.value.length * 180 + 160))
const svgH = computed(() => headH + props.messages.length * rowH + footH)

function click(i: number) {
  selectedMessageIndex.value = i
  emit('message-selected', props.messages[i])
}

function tc(type: string) {
  switch (type) {
    case 'MethodCall': return '#3498db'
    case 'MethodReturn': return '#27ae60'
    case 'Error': return '#e74c3c'
    case 'Signal': return '#f39c12'
    default: return '#95a5a6'
  }
}

function short(s: string) { return s.length > 20 ? s.slice(0, 18) + '..' : s }
function ts(t: number) {
  const d = new Date(t * 1000)
  return d.toLocaleTimeString() + '.' + String(d.getMilliseconds()).padStart(3, '0')
}
function lbl(m: DbusMessage) { return m.member || m.errorName || m.interface || m.type }
</script>

<template>
  <div class="diagram-wrapper" v-if="messages.length > 0">
    <svg :width="svgW" :height="svgH" class="seq-svg">
      <g v-for="p in participants" :key="p">
        <rect :x="(posMap[p] ?? 0) - 70" y="10" width="140" height="36" rx="6" fill="#2c3e50" />
        <text :x="posMap[p]" y="33" text-anchor="middle" fill="#ecf0f1" font-size="11" font-family="monospace" font-weight="bold">{{ short(p) }}</text>
        <line :x1="posMap[p]" y1="46" :x2="posMap[p]" :y2="svgH - footH" stroke="#bdc3c7" stroke-width="1" stroke-dasharray="4,4" />
      </g>

      <g v-for="(msg, i) in messages" :key="i" @click="click(i)" :class="{ sel: selectedMessageIndex === i }" class="mg">
        <template v-if="msg.sender && msg.destination && posMap[msg.sender] !== undefined && posMap[msg.destination] !== undefined">
          <text :x="4" :y="headH + i * rowH + 14" font-size="9" fill="#999" font-family="monospace">{{ ts(msg.timestamp) }}</text>

          <line :x1="posMap[msg.sender]" :y1="headH + i * rowH" :x2="posMap[msg.destination]" :y2="headH + i * rowH" :stroke="tc(msg.type)" stroke-width="2" />

          <polygon v-if="msg.type === 'Signal'" :points="`${posMap[msg.destination]},${headH + i * rowH} ${(posMap[msg.sender]! > posMap[msg.destination]! ? posMap[msg.sender]! + 7 : posMap[msg.sender]! - 7)},${headH + i * rowH - 4} ${(posMap[msg.sender]! > posMap[msg.destination]! ? posMap[msg.sender]! + 7 : posMap[msg.sender]! - 7)},${headH + i * rowH + 4}`" :fill="tc(msg.type)" />
          <polygon v-else :points="`${posMap[msg.destination]},${headH + i * rowH} ${posMap[msg.destination]! > posMap[msg.sender]! ? posMap[msg.destination]! - 7 : posMap[msg.destination]! + 7},${headH + i * rowH - 4} ${posMap[msg.destination]! > posMap[msg.sender]! ? posMap[msg.destination]! - 7 : posMap[msg.destination]! + 7},${headH + i * rowH + 4}`" :fill="tc(msg.type)" />

          <rect :x="(posMap[msg.sender]! + posMap[msg.destination]!) / 2 - 40" :y="headH + i * rowH - 18" width="80" height="16" rx="3" fill="white" stroke="#ddd" stroke-width="0.5" opacity="0.95" />
          <text :x="(posMap[msg.sender]! + posMap[msg.destination]!) / 2" :y="headH + i * rowH - 6" font-size="10" fill="#333" font-family="monospace" text-anchor="middle">{{ lbl(msg) }}</text>
          <text :x="(posMap[msg.sender]! + posMap[msg.destination]!) / 2" :y="headH + i * rowH + 13" font-size="8" :fill="tc(msg.type)" font-family="monospace" text-anchor="middle" font-weight="bold">{{ msg.type }}</text>
        </template>
      </g>

      <g :transform="`translate(10, ${svgH - 18})`">
        <circle cx="8" cy="0" r="4" fill="#3498db" /><text x="16" y="4" font-size="9" fill="#333">MethodCall</text>
        <circle cx="100" cy="0" r="4" fill="#27ae60" /><text x="108" y="4" font-size="9" fill="#333">MethodReturn</text>
        <circle cx="210" cy="0" r="4" fill="#e74c3c" /><text x="218" y="4" font-size="9" fill="#333">Error</text>
        <circle cx="270" cy="0" r="4" fill="#f39c12" /><text x="278" y="4" font-size="9" fill="#333">Signal</text>
      </g>
    </svg>
  </div>
  <div v-else class="empty">No messages to display. Load a pcap file to begin.</div>
</template>

<style scoped>
.diagram-wrapper { overflow: auto; background: white; border-radius: 8px; box-shadow: 0 1px 6px rgba(0,0,0,0.08); padding: 12px; }
.seq-svg { display: block; }
.mg { cursor: pointer; }
.mg:hover line, .mg:hover polygon { opacity: 0.7; }
.mg.sel line { stroke-width: 3; }
.mg.sel rect { stroke: #333; stroke-width: 1.5; }
.empty { text-align: center; color: #aaa; padding: 60px 20px; font-size: 14px; }
</style>

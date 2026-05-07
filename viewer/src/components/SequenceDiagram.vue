<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DbusMessage } from '../types/dbus'

const props = defineProps<{
  messages: DbusMessage[]
}>()

const emit = defineEmits<{
  (e: 'message-selected', message: DbusMessage): void
}>()

const selectedIdx = ref<number | null>(null)
const scrollEl = ref<HTMLElement | null>(null)
const scrollLeft = ref(0)

const participants = computed(() => {
  const set = new Set<string>()
  for (const m of props.messages) {
    if (m.sender) set.add(m.sender)
    if (m.destination) set.add(m.destination)
  }
  return Array.from(set).sort()
})

const sp = 200
const sx = 90
const rowH = 56
const headH = 44
const footH = 32

const posMap = computed(() => {
  const m: Record<string, number> = {}
  participants.value.forEach((p, i) => { m[p] = sx + i * sp })
  return m
})

const svgW = computed(() => Math.max(600, participants.value.length * 200 + 180))
const svgH = computed(() => headH + props.messages.length * rowH + footH)

function click(i: number) {
  selectedIdx.value = i
  emit('message-selected', props.messages[i])
}

function tc(type: string) {
  switch (type) {
    case 'MethodCall': return '#0969da'
    case 'MethodReturn': return '#1a7f37'
    case 'Error': return '#cf222e'
    case 'Signal': return '#9a6700'
    default: return '#8b949e'
  }
}

function short(s: string) { return s.length > 22 ? s.slice(0, 20) + '…' : s }

function fmtTs(t: number) {
  const d = new Date(t * 1000)
  return d.toLocaleTimeString() + '.' + String(d.getMilliseconds()).padStart(3, '0')
}

function lineY(i: number) { return headH + i * rowH + rowH / 2 }
function arrowX1(msg: DbusMessage) { return posMap.value[msg.sender!] ?? 0 }
function arrowX2(msg: DbusMessage) { return posMap.value[msg.destination!] ?? 0 }
function midX(msg: DbusMessage) { return (arrowX1(msg) + arrowX2(msg)) / 2 }
function arrowDir(msg: DbusMessage) { return arrowX2(msg) >= arrowX1(msg) ? 1 : -1 }

function arrowHead(msg: DbusMessage) {
  const x = arrowX2(msg)
  const y = lineY(props.messages.indexOf(msg))
  const d = arrowDir(msg)
  const s = 6
  return `${x},${y} ${x - d * s},${y - s} ${x - d * s},${y + s}`
}

function onScroll() {
  if (scrollEl.value) scrollLeft.value = scrollEl.value.scrollLeft
}

function label1(msg: DbusMessage) {
  return msg.member || msg.errorName || msg.interface || msg.type
}
function label2(msg: DbusMessage) {
  const parts: string[] = []
  if (msg.interface) parts.push(msg.interface)
  if (msg.member) parts.push(msg.member)
  return parts.join('.')
}
</script>

<template>
  <div class="diagram" v-if="messages.length > 0">
    <!-- 固定在顶部的参与者名称 -->
    <div class="sticky-header" :style="{ width: svgW + 'px' }">
      <div class="header-scroll" :style="{ transform: `translateX(${-scrollLeft}px)` }">
        <div v-for="p in participants" :key="p" class="participant-box"
          :style="{ left: (posMap[p] ?? 0) - 80 + 'px' }">
          <span class="participant-name">{{ short(p) }}</span>
        </div>
      </div>
    </div>

    <!-- 可滚动的消息体 -->
    <div class="scroll-body" ref="scrollEl" @scroll="onScroll">
      <svg :width="svgW" :height="svgH" class="seq-svg">
        <!-- 网格线 -->
        <line v-for="p in participants" :key="'g-' + p"
          :x1="posMap[p]" :y1="0" :x2="posMap[p]" :y2="svgH - footH"
          stroke="#e8eaed" stroke-width="1" stroke-dasharray="3,3" />

        <!-- 消息行 -->
        <g v-for="(msg, i) in messages" :key="i"
          @click="click(i)" class="msg-row" :class="{ sel: selectedIdx === i }">

          <template v-if="msg.sender && msg.destination
            && posMap[msg.sender] !== undefined && posMap[msg.destination] !== undefined">

            <!-- 交替背景 -->
            <rect x="0" :y="headH + i * rowH" :width="svgW" :height="rowH"
              :fill="i % 2 === 0 ? '#f6f8fa' : 'transparent'" />

            <!-- 时间戳 -->
            <text :x="6" :y="lineY(i) + 4" font-size="9" fill="#8b949e"
              font-family="monospace">{{ fmtTs(msg.timestamp) }}</text>

            <!-- 连线 -->
            <line :x1="arrowX1(msg)" :y1="lineY(i)" :x2="arrowX2(msg)" :y2="lineY(i)"
              :stroke="tc(msg.type)" stroke-width="1.5" />

            <!-- 箭头 -->
            <polygon :points="arrowHead(msg)" :fill="tc(msg.type)" />

            <!-- 标签背景 -->
            <rect :x="midX(msg) - 80" :y="lineY(i) - 18" width="160" height="34"
              rx="5" fill="white"
              :stroke="selectedIdx === i ? tc(msg.type) : '#d0d7de'"
              :stroke-width="selectedIdx === i ? 1.5 : 0.5" />

            <!-- 第一行：member name -->
            <text :x="midX(msg)" :y="lineY(i) - 4" font-size="10.5" fill="#24292e"
              font-family="monospace" text-anchor="middle" font-weight="600">
              {{ label1(msg) }}
            </text>

            <!-- 第二行：interface.member（弱化） -->
            <text :x="midX(msg)" :y="lineY(i) + 12" font-size="8.5" fill="#8b949e"
              font-family="monospace" text-anchor="middle">
              {{ label2(msg) }}
            </text>

            <!-- 起点圆点 -->
            <circle :cx="arrowX1(msg)" :cy="lineY(i)" r="3"
              :fill="tc(msg.type)" opacity="0.5" />
          </template>
        </g>

        <!-- 图例 -->
        <g :transform="`translate(10, ${svgH - 18})`">
          <g v-for="(item, li) in [
            { color: '#0969da', label: 'MethodCall' },
            { color: '#1a7f37', label: 'MethodReturn' },
            { color: '#cf222e', label: 'Error' },
            { color: '#9a6700', label: 'Signal' },
          ]" :key="li" :transform="`translate(${li * 110}, 0)`">
            <circle cx="5" cy="0" r="3" :fill="item.color" />
            <text x="13" y="3" font-size="9" fill="#586069" font-family="monospace">{{ item.label }}</text>
          </g>
        </g>
      </svg>
    </div>
  </div>
  <div v-else class="empty">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d0d7de" stroke-width="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
    <p>Load a PCAP file to view D-Bus messages</p>
  </div>
</template>

<style scoped>
.diagram {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.sticky-header {
  position: sticky;
  top: 0;
  z-index: 5;
  height: 42px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}

.header-scroll {
  position: relative;
  height: 100%;
  transition: transform 0.05s linear;
}

.participant-box {
  position: absolute;
  top: 4px;
  width: 160px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #24292e;
  border-radius: 6px;
}

.participant-name {
  font-size: 11px;
  font-family: monospace;
  font-weight: 600;
  color: #f0f2f5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 8px;
  max-width: 100%;
}

.scroll-body {
  overflow: auto;
}

.seq-svg {
  display: block;
}

.msg-row {
  cursor: pointer;
}

.msg-row:hover rect:first-child {
  fill: #eef1f5 !important;
}

.msg-row.sel rect:first-child {
  fill: var(--accent-bg) !important;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 20px;
  color: var(--text-muted);
  font-size: 0.875rem;
}
</style>

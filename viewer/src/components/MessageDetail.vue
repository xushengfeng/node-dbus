<script setup lang="ts">
import { computed } from 'vue'
import type { DbusMessage } from '../types/dbus'

const props = defineProps<{
  message: DbusMessage
}>()

const typeStyle = computed(() => {
  switch (props.message.type) {
    case 'MethodCall': return { bg: 'var(--blue-bg)', fg: 'var(--blue)', icon: '→' }
    case 'MethodReturn': return { bg: 'var(--green-bg)', fg: 'var(--green)', icon: '←' }
    case 'Error': return { bg: 'var(--red-bg)', fg: 'var(--red)', icon: '✗' }
    case 'Signal': return { bg: 'var(--orange-bg)', fg: 'var(--orange)', icon: '▶' }
    default: return { bg: '#f6f8fa', fg: 'var(--text-muted)', icon: '—' }
  }
})

const fields = computed(() => {
  const m = props.message
  const list: Array<{ label: string; value: string; mono?: boolean }> = []
  if (m.path) list.push({ label: 'Path', value: m.path, mono: true })
  if (m.interface) list.push({ label: 'Interface', value: m.interface, mono: true })
  if (m.member) list.push({ label: 'Member', value: m.member, mono: true })
  if (m.errorName) list.push({ label: 'Error', value: m.errorName, mono: true })
  if (m.sender) list.push({ label: 'Sender', value: m.sender, mono: true })
  if (m.destination) list.push({ label: 'Destination', value: m.destination, mono: true })
  if (m.signature) list.push({ label: 'Signature', value: m.signature, mono: true })
  if (m.replySerial !== undefined) list.push({ label: 'Reply Serial', value: String(m.replySerial) })
  list.push({ label: 'Serial', value: String(m.serial) })
  return list
})

const formattedBody = computed(() => {
  const b = props.message.body
  if (!b || b.length === 0) return null
  try { return JSON.stringify(b, null, 2) }
  catch { return String(b) }
})

function fmtTs(ts: number) {
  const d = new Date(ts * 1000)
  return d.toLocaleTimeString() + '.' + String(d.getMilliseconds()).padStart(3, '0')
}
</script>

<template>
  <div class="detail">
    <div class="type-row">
      <span class="type-badge" :style="{ background: typeStyle.bg, color: typeStyle.fg }">
        <span class="type-icon">{{ typeStyle.icon }}</span>
        {{ message.type }}
      </span>
      <span class="timestamp">{{ fmtTs(message.timestamp) }}</span>
    </div>

    <div class="fields">
      <div v-for="f in fields" :key="f.label" class="field-row">
        <span class="field-label">{{ f.label }}</span>
        <span class="field-value" :class="{ mono: f.mono }">{{ f.value }}</span>
      </div>
    </div>

    <div v-if="formattedBody" class="body-section">
      <div class="section-label">Body</div>
      <pre class="body-code">{{ formattedBody }}</pre>
    </div>
  </div>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.type-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.type-icon {
  font-size: 0.65rem;
}

.timestamp {
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--text-muted);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.field-row {
  display: flex;
  align-items: baseline;
  padding: 7px 10px;
  background: var(--surface);
  gap: 8px;
}

.field-label {
  flex-shrink: 0;
  width: 90px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

.field-value {
  font-size: 0.8125rem;
  color: var(--text);
  word-break: break-all;
}

.field-value.mono {
  font-family: monospace;
  font-size: 0.75rem;
}

.body-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

.body-code {
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  font-size: 0.75rem;
  line-height: 1.6;
  padding: 10px 12px;
  background: #f6f8fa;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text);
}
</style>

<script setup lang="ts">
import { computed } from 'vue'
import type { DbusMessage } from '../types/dbus'

const props = defineProps<{
  message: DbusMessage
}>()

const headerFields = computed(() => {
  const fields = []
  
  if (props.message.path) {
    fields.push({ label: 'Path', value: props.message.path })
  }
  if (props.message.interface) {
    fields.push({ label: 'Interface', value: props.message.interface })
  }
  if (props.message.member) {
    fields.push({ label: 'Member', value: props.message.member })
  }
  if (props.message.destination) {
    fields.push({ label: 'Destination', value: props.message.destination })
  }
  if (props.message.sender) {
    fields.push({ label: 'Sender', value: props.message.sender })
  }
  if (props.message.signature) {
    fields.push({ label: 'Signature', value: props.message.signature })
  }
  if (props.message.errorName) {
    fields.push({ label: 'Error Name', value: props.message.errorName })
  }
  if (props.message.replySerial !== undefined) {
    fields.push({ label: 'Reply Serial', value: props.message.replySerial.toString() })
  }
  
  return fields
})

const messageTypeColor = computed(() => {
  switch (props.message.type) {
    case 'MethodCall':
      return '#3498db'
    case 'MethodReturn':
      return '#2ecc71'
    case 'Error':
      return '#e74c3c'
    case 'Signal':
      return '#f39c12'
    default:
      return '#95a5a6'
  }
})

const formattedBody = computed(() => {
  if (!props.message.body || props.message.body.length === 0) {
    return 'No body'
  }
  
  try {
    return JSON.stringify(props.message.body, null, 2)
  } catch {
    return String(props.message.body)
  }
})

const formattedRawHeader = computed(() => {
  try {
    return JSON.stringify(props.message.raw.header, null, 2)
  } catch {
    return 'Unable to display raw header'
  }
})

const formattedRawBody = computed(() => {
  try {
    return JSON.stringify(props.message.raw.body, null, 2)
  } catch {
    return 'Unable to display raw body'
  }
})

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString() + '.' + date.getMilliseconds().toString().padStart(3, '0')
}
</script>

<template>
  <div class="message-detail">
    <h2 class="detail-title">Message Details</h2>
    
    <div class="detail-section">
      <h3 class="section-title">Basic Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Type:</span>
          <span 
            class="detail-value type-badge"
            :style="{ backgroundColor: messageTypeColor }"
          >
            {{ message.type }}
          </span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Serial:</span>
          <span class="detail-value">{{ message.serial }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Timestamp:</span>
          <span class="detail-value">{{ formatTimestamp(message.timestamp) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Source:</span>
          <span class="detail-value">{{ message.source }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Destination:</span>
          <span class="detail-value">{{ message.destination }}</span>
        </div>
      </div>
    </div>
    
    <div class="detail-section" v-if="headerFields.length > 0">
      <h3 class="section-title">Header Fields</h3>
      <div class="detail-grid">
        <div 
          v-for="field in headerFields" 
          :key="field.label"
          class="detail-item"
        >
          <span class="detail-label">{{ field.label }}:</span>
          <span class="detail-value">{{ field.value }}</span>
        </div>
      </div>
    </div>
    
    <div class="detail-section">
      <h3 class="section-title">Body</h3>
      <pre class="body-content">{{ formattedBody }}</pre>
    </div>
    
    <div class="detail-section">
      <h3 class="section-title">Raw Data</h3>
      <div class="raw-data-container">
        <div class="raw-data-section">
          <h4>Header</h4>
          <pre class="raw-content">{{ formattedRawHeader }}</pre>
        </div>
        <div class="raw-data-section">
          <h4>Body</h4>
          <pre class="raw-content">{{ formattedRawBody }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-detail {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.detail-title {
  margin: 0 0 1.5rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #3498db;
  color: #2c3e50;
  font-size: 1.5rem;
}

.detail-section {
  margin-bottom: 1.5rem;
}

.section-title {
  margin: 0 0 0.75rem 0;
  color: #34495e;
  font-size: 1.1rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.5rem;
}

.detail-grid {
  display: grid;
  gap: 0.5rem;
}

.detail-item {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.detail-label {
  font-weight: 600;
  color: #7f8c8d;
  min-width: 100px;
  font-size: 0.9rem;
}

.detail-value {
  color: #2c3e50;
  word-break: break-all;
}

.type-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  color: white;
  font-size: 0.8rem;
  font-weight: 600;
}

.body-content {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 1rem;
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.raw-data-container {
  display: grid;
  gap: 1rem;
}

.raw-data-section {
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 1rem;
}

.raw-data-section h4 {
  margin: 0 0 0.5rem 0;
  color: #34495e;
  font-size: 0.9rem;
}

.raw-content {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
<script setup lang="ts">
import { ref } from 'vue'
import { extractDbusMessagesFromPcap } from '../utils/pcapDbusExtractor'
import type { DbusMessage } from '../types/dbus'

const emit = defineEmits<{
  (e: 'messages-loaded', messages: DbusMessage[]): void
}>()

const isLoading = ref(false)
const error = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  isLoading.value = true
  error.value = null

  try {
    const arrayBuffer = await file.arrayBuffer()
    const messages = extractDbusMessagesFromPcap(new Uint8Array(arrayBuffer))
    if (messages.length === 0) {
      error.value = 'No DBus messages found'
    } else {
      emit('messages-loaded', messages)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}
</script>

<template>
  <div class="uploader">
    <input ref="fileInput" type="file" accept=".pcap,.pcapng" @change="handleFileUpload" />
    <button class="btn" @click="fileInput?.click()" :disabled="isLoading">
      <svg v-if="!isLoading" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <path d="M2.75 14A1.75 1.75 0 011 12.25v-2.5a.75.75 0 011.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25v-2.5a.75.75 0 011.5 0v2.5A1.75 1.75 0 0113.25 14H2.75z"/>
        <path d="M7.25 7.689V2a.75.75 0 011.5 0v5.689l1.97-1.969a.749.749 0 111.06 1.06l-3.25 3.25a.749.749 0 01-1.06 0L4.22 6.78a.749.749 0 111.06-1.06l1.97 1.969z"/>
      </svg>
      <span v-if="isLoading" class="spinner"></span>
      {{ isLoading ? 'Loading...' : 'Open PCAP' }}
    </button>
    <span v-if="error" class="error">{{ error }}</span>
  </div>
</template>

<style scoped>
.uploader {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  font-size: 0.8125rem;
  font-weight: 500;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  transition: all 0.15s;
}

.btn:hover {
  background: var(--surface-hover);
  border-color: #d0d7de;
  box-shadow: var(--shadow-sm);
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error {
  font-size: 0.75rem;
  color: var(--red);
}
</style>

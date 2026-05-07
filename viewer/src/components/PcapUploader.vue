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
    const uint8Array = new Uint8Array(arrayBuffer)
    const messages = extractDbusMessagesFromPcap(uint8Array)
    
    if (messages.length === 0) {
      error.value = 'No DBus messages found in the pcap file'
    } else {
      emit('messages-loaded', messages)
    }
  } catch (err) {
    error.value = `Failed to parse pcap file: ${err instanceof Error ? err.message : String(err)}`
  } finally {
    isLoading.value = false
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}
</script>

<template>
  <div class="pcap-uploader">
    <input
      ref="fileInput"
      type="file"
      accept=".pcap,.pcapng"
      @change="handleFileUpload"
      style="display: none"
    />
    
    <button @click="triggerFileInput" :disabled="isLoading">
      {{ isLoading ? 'Loading...' : 'Load PCAP File' }}
    </button>
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.pcap-uploader {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.error-message {
  color: #e74c3c;
  font-size: 0.9rem;
}

button:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}
</style>
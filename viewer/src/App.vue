<script setup lang="ts">
import { ref } from 'vue'
import PcapUploader from './components/PcapUploader.vue'
import SequenceDiagram from './components/SequenceDiagram.vue'
import MessageDetail from './components/MessageDetail.vue'
import type { DbusMessage } from './types/dbus'

const messages = ref<DbusMessage[]>([])
const selectedMessage = ref<DbusMessage | null>(null)

const handleMessagesLoaded = (loadedMessages: DbusMessage[]) => {
  messages.value = loadedMessages
  selectedMessage.value = null
}

const handleMessageSelected = (message: DbusMessage) => {
  selectedMessage.value = message
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>DBus PCAP Viewer</h1>
      <div class="header-controls">
        <PcapUploader @messages-loaded="handleMessagesLoaded" />
        <span v-if="messages.length > 0" class="msg-count">{{ messages.length }} messages</span>
      </div>
    </header>
    
    <main class="app-main">
      <div class="diagram-container">
        <SequenceDiagram 
          :messages="messages" 
          @message-selected="handleMessageSelected"
        />
      </div>
      
      <aside class="detail-sidebar" v-if="selectedMessage">
        <MessageDetail :message="selectedMessage" />
      </aside>
    </main>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: Arial, sans-serif;
}

.app-header {
  background-color: #2c3e50;
  color: white;
  padding: 0.8rem 1.2rem;
  display: flex;
  align-items: center;
  gap: 2rem;
}

.app-header h1 {
  margin: 0;
  font-size: 1.4rem;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.msg-count {
  font-size: 0.9rem;
  color: #95a5a6;
}

.app-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.diagram-container {
  flex: 1;
  overflow: auto;
  padding: 1rem;
}

.detail-sidebar {
  width: 420px;
  min-width: 420px;
  background-color: #f8f9fa;
  border-left: 1px solid #dee2e6;
  overflow-y: auto;
  padding: 1rem;
}
</style>
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
  <div class="app">
    <header class="topbar">
      <div class="topbar-left">
        <svg class="logo-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
        </svg>
        <h1>DBus Viewer</h1>
      </div>
      <div class="topbar-right">
        <PcapUploader @messages-loaded="handleMessagesLoaded" />
        <span v-if="messages.length > 0" class="badge">{{ messages.length }}</span>
      </div>
    </header>

    <main class="main">
      <div class="diagram-panel" :class="{ 'has-sidebar': selectedMessage }">
        <SequenceDiagram
          :messages="messages"
          @message-selected="handleMessageSelected"
        />
      </div>
      <Transition name="slide">
        <aside v-if="selectedMessage" class="sidebar">
          <div class="sidebar-header">
            <span class="sidebar-title">Message Detail</span>
            <button class="close-btn" @click="selectedMessage = null" title="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
              </svg>
            </button>
          </div>
          <div class="sidebar-body">
            <MessageDetail :message="selectedMessage" />
          </div>
        </aside>
      </Transition>
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 48px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  z-index: 10;
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon {
  color: var(--accent);
}

.topbar h1 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.badge {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--accent-bg);
  color: var(--blue);
}

.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.diagram-panel {
  flex: 1;
  overflow: auto;
  padding: 16px;
  transition: margin-right 0.25s ease;
}

.diagram-panel.has-sidebar {
  margin-right: 0;
}

.sidebar {
  width: 400px;
  min-width: 400px;
  border-left: 1px solid var(--border);
  background: var(--surface);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
}

.close-btn:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
</style>

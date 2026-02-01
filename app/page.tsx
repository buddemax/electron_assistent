'use client'

import { AnimatePresence } from 'framer-motion'
import { AppShell } from '@/components/layout'
import { VoiceInput } from '@/components/voice'
import { OutputPanel } from '@/components/output/output-panel'
import { SettingsModal } from '@/components/settings'
import { KnowledgePanel } from '@/components/knowledge'
import { useVoiceStore } from '@/stores/voice-store'
import { useOutputStore } from '@/stores/output-store'
import { useAppStore } from '@/stores/app-store'

export default function Home() {
  const { voiceMode } = useVoiceStore()
  const { currentOutput, isGenerating } = useOutputStore()
  const { isKnowledgePanelOpen, setKnowledgePanelOpen } = useAppStore()

  const showOutput = currentOutput || isGenerating

  return (
    <AppShell>
      <SettingsModal />
      <AnimatePresence>
        {isKnowledgePanelOpen && (
          <KnowledgePanel onClose={() => setKnowledgePanelOpen(false)} />
        )}
      </AnimatePresence>
      <div className="h-full flex flex-col">
        {/* Voice Input Section */}
        <div
          className={`
            flex-shrink-0 transition-all duration-300 ease-out
            ${showOutput ? 'h-48' : 'flex-1 flex items-center justify-center'}
          `}
        >
          <VoiceInput />
        </div>

        {/* Output Section */}
        {showOutput && (
          <div className="flex-1 overflow-hidden border-t border-[var(--border)]">
            <OutputPanel />
          </div>
        )}

        {/* Status Bar */}
        <footer className="h-8 flex items-center justify-between px-4 text-[10px] text-[var(--text-muted)] border-t border-[var(--border-subtle)] bg-[var(--bg-primary)]/50">
          <span>
            {voiceMode === 'idle' && 'Bereit'}
            {voiceMode === 'recording' && 'Aufnahme läuft...'}
            {voiceMode === 'transcribing' && 'Transkribiere...'}
            {voiceMode === 'processing' && 'Generiere...'}
            {voiceMode === 'error' && 'Fehler aufgetreten'}
          </span>
          <span className="flex items-center gap-2">
            <kbd className="px-1 py-0.5 bg-[var(--bg-secondary)] rounded text-[var(--text-tertiary)]">
              ⌘⇧Space
            </kbd>
            <span>zum Aktivieren</span>
          </span>
        </footer>
      </div>
    </AppShell>
  )
}

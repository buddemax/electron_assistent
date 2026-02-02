'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'

type SettingsTab = 'general' | 'voice' | 'api' | 'appearance' | 'hotkeys'

export function SettingsModal() {
  const { isSettingsOpen, setSettingsOpen, settings, updateSettings, profile, resetOnboarding } = useAppStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: 'Allgemein' },
    { id: 'voice', label: 'Sprache' },
    { id: 'api', label: 'API Keys' },
    { id: 'appearance', label: 'Aussehen' },
    { id: 'hotkeys', label: 'Shortcuts' },
  ]

  if (!isSettingsOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setSettingsOpen(false)}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative w-full max-w-lg bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-medium text-[var(--text-primary)]">
              Einstellungen
            </h2>
            <button
              onClick={() => setSettingsOpen(false)}
              className="p-2 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex h-[400px]">
            {/* Sidebar */}
            <nav className="w-40 border-r border-[var(--border)] p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full px-3 py-2 text-left text-sm rounded-[var(--radius-sm)]
                    transition-colors duration-[var(--transition-fast)]
                    ${
                      activeTab === tab.id
                        ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Content */}
            <div className="flex-1 p-6 overflow-auto">
              {activeTab === 'general' && (
                <GeneralSettings
                  settings={settings.general}
                  onUpdate={(v) => updateSettings('general', v)}
                  profile={profile}
                  onResetOnboarding={resetOnboarding}
                />
              )}
              {activeTab === 'voice' && (
                <VoiceSettings settings={settings.voice} onUpdate={(v) => updateSettings('voice', v)} />
              )}
              {activeTab === 'api' && (
                <ApiSettings settings={settings.api} onUpdate={(v) => updateSettings('api', v)} />
              )}
              {activeTab === 'appearance' && (
                <AppearanceSettings settings={settings.appearance} onUpdate={(v) => updateSettings('appearance', v)} />
              )}
              {activeTab === 'hotkeys' && (
                <HotkeySettings settings={settings.hotkeys} onUpdate={(v) => updateSettings('hotkeys', v)} />
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Settings Sections
interface SettingsSectionProps<T> {
  settings: T
  onUpdate: (value: Partial<T>) => void
}

interface GeneralSettingsProps extends SettingsSectionProps<typeof import('@/types/settings').DEFAULT_SETTINGS.general> {
  profile: import('@/types/profile').UserProfile
  onResetOnboarding: () => void
}

function GeneralSettings({ settings, onUpdate, profile, onResetOnboarding }: GeneralSettingsProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const { updateProfileField } = useAppStore()

  const handleResetOnboarding = () => {
    onResetOnboarding()
    setShowResetConfirm(false)
  }

  const profileSummary = [
    profile.jobRole,
    profile.industry,
    profile.signatureName,
  ].filter(Boolean).join(', ') || 'Nicht konfiguriert'

  return (
    <div className="space-y-6">
      <SettingsRow
        label="Standard-Modus"
        description="Beim Start aktiver Kontext"
      >
        <select
          value={settings.defaultMode}
          onChange={(e) => onUpdate({ defaultMode: e.target.value as 'private' | 'work' })}
          className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="work">Beruflich</option>
          <option value="private">Privat</option>
        </select>
      </SettingsRow>

      <SettingsRow
        label="Output-Länge"
        description="Wie ausführlich sollen Texte sein?"
      >
        <select
          value={profile.preferredOutputLength}
          onChange={(e) => updateProfileField('preferredOutputLength', e.target.value as 'concise' | 'balanced' | 'detailed')}
          className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="concise">Kurz & knapp</option>
          <option value="balanced">Ausgewogen</option>
          <option value="detailed">Ausführlich</option>
        </select>
      </SettingsRow>

      <SettingsRow
        label="Auto-Speichern"
        description="Neue Infos automatisch in Knowledge Base speichern"
      >
        <Toggle
          checked={settings.autoSaveToKnowledge}
          onChange={(checked) => onUpdate({ autoSaveToKnowledge: checked })}
        />
      </SettingsRow>

      <SettingsRow
        label="Smart Suggestions"
        description="Proaktive Kontext-Vorschläge anzeigen"
      >
        <Toggle
          checked={settings.showSuggestions}
          onChange={(checked) => onUpdate({ showSuggestions: checked })}
        />
      </SettingsRow>

      <SettingsRow
        label="Sprache"
        description="UI und Output-Sprache"
      >
        <select
          value={settings.language}
          onChange={(e) => onUpdate({ language: e.target.value as 'de' | 'en' })}
          className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </SettingsRow>

      {/* Profile / Onboarding Section */}
      <div className="pt-4 border-t border-[var(--border)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Profil</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5 max-w-[200px] truncate">
              {profileSummary}
            </p>
          </div>
          {showResetConfirm ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowResetConfirm(false)}
              >
                Abbrechen
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleResetOnboarding}
              >
                Zurücksetzen
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowResetConfirm(true)}
            >
              Neu einrichten
            </Button>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Setzt das Profil zurück und startet das Onboarding erneut.
        </p>
      </div>
    </div>
  )
}

function VoiceSettings({ settings, onUpdate }: SettingsSectionProps<typeof import('@/types/settings').DEFAULT_SETTINGS.voice>) {
  return (
    <div className="space-y-6">
      <SettingsRow
        label="Max. Aufnahmedauer"
        description="In Sekunden"
      >
        <input
          type="number"
          value={settings.maxRecordingDuration}
          onChange={(e) => onUpdate({ maxRecordingDuration: Number(e.target.value) })}
          min={10}
          max={300}
          className="w-20 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        />
      </SettingsRow>

      <SettingsRow
        label="Auto-Stop bei Stille"
        description="Aufnahme automatisch beenden"
      >
        <Toggle
          checked={settings.autoStopOnSilence}
          onChange={(checked) => onUpdate({ autoStopOnSilence: checked })}
        />
      </SettingsRow>

      <SettingsRow
        label="Stille-Dauer"
        description="Sekunden Stille bis Auto-Stop"
      >
        <input
          type="number"
          value={settings.silenceDuration}
          onChange={(e) => onUpdate({ silenceDuration: Number(e.target.value) })}
          min={1}
          max={10}
          step={0.5}
          className="w-20 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        />
      </SettingsRow>

      <SettingsRow
        label="Feedback-Sounds"
        description="Akustisches Feedback bei Start/Stop"
      >
        <Toggle
          checked={settings.playFeedbackSounds}
          onChange={(checked) => onUpdate({ playFeedbackSounds: checked })}
        />
      </SettingsRow>
    </div>
  )
}

function ApiSettings({ settings, onUpdate }: SettingsSectionProps<typeof import('@/types/settings').DEFAULT_SETTINGS.api>) {
  const [showGroqKey, setShowGroqKey] = useState(false)
  const [showGeminiKey, setShowGeminiKey] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          Groq API Key
        </label>
        <p className="text-xs text-[var(--text-tertiary)] mb-2">
          Für Whisper Transkription
        </p>
        <div className="relative">
          <input
            type={showGroqKey ? 'text' : 'password'}
            value={settings.groqApiKey}
            onChange={(e) => onUpdate({ groqApiKey: e.target.value })}
            placeholder="gsk_..."
            className="w-full px-3 py-2 pr-10 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={() => setShowGroqKey(!showGroqKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            {showGroqKey ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          Google Gemini API Key
        </label>
        <p className="text-xs text-[var(--text-tertiary)] mb-2">
          Für Output-Generierung
        </p>
        <div className="relative">
          <input
            type={showGeminiKey ? 'text' : 'password'}
            value={settings.geminiApiKey}
            onChange={(e) => onUpdate({ geminiApiKey: e.target.value })}
            placeholder="AIza..."
            className="w-full px-3 py-2 pr-10 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={() => setShowGeminiKey(!showGeminiKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            {showGeminiKey ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        API Keys werden lokal gespeichert und nie an Dritte weitergegeben.
      </p>
    </div>
  )
}

function AppearanceSettings({ settings, onUpdate }: SettingsSectionProps<typeof import('@/types/settings').DEFAULT_SETTINGS.appearance>) {
  return (
    <div className="space-y-6">
      <SettingsRow
        label="Theme"
        description="Farbschema der Anwendung"
      >
        <select
          value={settings.theme}
          onChange={(e) => onUpdate({ theme: e.target.value as 'dark' | 'light' | 'system' })}
          className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-sm)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="dark">Dunkel</option>
          <option value="light">Hell</option>
          <option value="system">System</option>
        </select>
      </SettingsRow>

      <SettingsRow
        label="Waveform anzeigen"
        description="Audio-Visualisierung während Aufnahme"
      >
        <Toggle
          checked={settings.showWaveform}
          onChange={(checked) => onUpdate({ showWaveform: checked })}
        />
      </SettingsRow>

      <SettingsRow
        label="Kompakt-Modus"
        description="Reduzierte UI für mehr Fokus"
      >
        <Toggle
          checked={settings.compactMode}
          onChange={(checked) => onUpdate({ compactMode: checked })}
        />
      </SettingsRow>

      <SettingsRow
        label="Immer im Vordergrund"
        description="Fenster bleibt über anderen Apps"
      >
        <Toggle
          checked={settings.alwaysOnTop}
          onChange={(checked) => onUpdate({ alwaysOnTop: checked })}
        />
      </SettingsRow>
    </div>
  )
}

function HotkeySettings({ settings }: SettingsSectionProps<typeof import('@/types/settings').DEFAULT_SETTINGS.hotkeys>) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-[var(--text-tertiary)] mb-4">
        Globale Shortcuts funktionieren auch wenn die App im Hintergrund ist.
      </p>

      <SettingsRow
        label="Aktivieren"
        description="App öffnen / Aufnahme starten"
      >
        <kbd className="px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-xs font-mono text-[var(--text-secondary)]">
          ⌘ ⇧ Space
        </kbd>
      </SettingsRow>

      <SettingsRow
        label="Modus wechseln"
        description="Zwischen Privat/Beruflich"
      >
        <kbd className="px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-xs font-mono text-[var(--text-secondary)]">
          ⌘ ⇧ M
        </kbd>
      </SettingsRow>

      <SettingsRow
        label="Aufnahme stoppen"
        description="Aufnahme beenden"
      >
        <kbd className="px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-xs font-mono text-[var(--text-secondary)]">
          Esc
        </kbd>
      </SettingsRow>

      <SettingsRow
        label="Output kopieren"
        description="Aktuellen Output in Zwischenablage"
      >
        <kbd className="px-2 py-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-xs font-mono text-[var(--text-secondary)]">
          ⌘ C
        </kbd>
      </SettingsRow>
    </div>
  )
}

// Helper Components
interface SettingsRowProps {
  label: string
  description?: string
  children: React.ReactNode
}

function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {description && (
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

// Icons
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

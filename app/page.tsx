'use client'

import { useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppShell } from '@/components/layout'
import { VoiceInput } from '@/components/voice'
import { OutputPanel } from '@/components/output/output-panel'
import { SettingsModal } from '@/components/settings'
import { KnowledgePanel } from '@/components/knowledge'
import { OnboardingWizard } from '@/components/onboarding'
import { MeetingModeView } from '@/components/meeting'
import { useVoiceStore } from '@/stores/voice-store'
import { useOutputStore } from '@/stores/output-store'
import { useAppStore, type AppMode } from '@/stores/app-store'
import { useMeetingStore } from '@/stores/meeting-store'
import type { UserProfile } from '@/types/profile'

export default function Home() {
  const { voiceMode } = useVoiceStore()
  const { currentOutput, isGenerating } = useOutputStore()
  const {
    appMode,
    setAppMode,
    isKnowledgePanelOpen,
    setKnowledgePanelOpen,
    onboardingComplete,
    setProfile,
    completeOnboarding,
  } = useAppStore()
  const { status: meetingStatus, stopMeeting } = useMeetingStore()

  const handleOnboardingComplete = useCallback(
    (profile: UserProfile) => {
      setProfile(profile)
      completeOnboarding()
    },
    [setProfile, completeOnboarding]
  )

  // Handle Electron meeting events
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return

    const unsubStop = window.electronAPI.on.meetingStopRequested(() => {
      if (meetingStatus === 'recording' || meetingStatus === 'paused') {
        stopMeeting()
      }
    })

    const unsubQuit = window.electronAPI.on.meetingQuitWarning(() => {
      // Show warning that meeting is active
      alert('Ein Meeting läuft noch. Bitte beende das Meeting zuerst.')
    })

    return () => {
      unsubStop()
      unsubQuit()
    }
  }, [meetingStatus, stopMeeting])

  // Sync meeting status with Electron
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return
    window.electronAPI.meeting.updateStatus(meetingStatus)
  }, [meetingStatus])

  if (!onboardingComplete) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />
  }

  const showOutput = currentOutput || isGenerating
  const isMeetingActive = meetingStatus === 'recording' || meetingStatus === 'paused'

  return (
    <AppShell>
      <SettingsModal />
      <AnimatePresence>
        {isKnowledgePanelOpen && (
          <KnowledgePanel onClose={() => setKnowledgePanelOpen(false)} />
        )}
      </AnimatePresence>
      <div className="h-full flex flex-col">
        {/* App Mode Tabs */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border)]">
          <AppModeTab
            mode="voice"
            label="Sprache"
            icon={<MicIcon />}
            isActive={appMode === 'voice'}
            onClick={() => setAppMode('voice')}
            disabled={isMeetingActive}
          />
          <AppModeTab
            mode="meeting"
            label="Meeting"
            icon={<UsersIcon />}
            isActive={appMode === 'meeting'}
            onClick={() => setAppMode('meeting')}
            isRecording={isMeetingActive}
          />
        </div>

        {/* Content based on mode */}
        <AnimatePresence mode="wait">
          {appMode === 'voice' ? (
            <motion.div
              key="voice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
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
            </motion.div>
          ) : (
            <motion.div
              key="meeting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-hidden p-4"
            >
              <MeetingModeView />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Bar */}
        <footer className="h-8 flex items-center justify-between px-4 text-[10px] text-[var(--text-muted)] border-t border-[var(--border-subtle)] bg-[var(--bg-primary)]/50">
          <span>
            {appMode === 'voice' && (
              <>
                {voiceMode === 'idle' && 'Bereit'}
                {voiceMode === 'recording' && 'Aufnahme läuft...'}
                {voiceMode === 'transcribing' && 'Transkribiere...'}
                {voiceMode === 'processing' && 'Generiere...'}
                {voiceMode === 'error' && 'Fehler aufgetreten'}
              </>
            )}
            {appMode === 'meeting' && (
              <>
                {meetingStatus === 'idle' && 'Meeting-Modus bereit'}
                {meetingStatus === 'recording' && 'Meeting wird aufgezeichnet'}
                {meetingStatus === 'paused' && 'Meeting pausiert'}
                {meetingStatus === 'processing' && 'Meeting wird verarbeitet...'}
              </>
            )}
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

interface AppModeTabProps {
  mode: AppMode
  label: string
  icon: React.ReactNode
  isActive: boolean
  onClick: () => void
  disabled?: boolean
  isRecording?: boolean
}

function AppModeTab({ label, icon, isActive, onClick, disabled, isRecording }: AppModeTabProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
        ${isActive
          ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {icon}
      {label}
      {isRecording && (
        <motion.div
          className="w-2 h-2 rounded-full bg-red-500"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </button>
  )
}

function MicIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

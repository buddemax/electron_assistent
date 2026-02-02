'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranscriptStore } from '@/stores/transcript-store'
import { useMeetingStore } from '@/stores/meeting-store'
import { getSpeakerColor } from '@/types/meeting'

interface SpeakerTaggerProps {
  isRecording: boolean
}

export function SpeakerTagger({ isRecording }: SpeakerTaggerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [newSpeakerName, setNewSpeakerName] = useState('')
  const [showSuccess, setShowSuccess] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { speakers, addSpeaker, setActiveSpeaker, activeSpeakerId } = useTranscriptStore()
  const { currentMeeting } = useMeetingStore()

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isExpanded])

  // Keyboard shortcut: Press 'S' to open speaker tagger
  useEffect(() => {
    if (!isRecording) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setIsExpanded(true)
      }

      // Number keys 1-9 to quickly select existing speakers
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1
        if (speakers[index]) {
          handleSelectSpeaker(speakers[index].id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRecording, speakers])

  const handleAddSpeaker = useCallback(() => {
    if (!newSpeakerName.trim()) return

    const speakerId = crypto.randomUUID()
    const speakerLabel = newSpeakerName.trim()

    addSpeaker({
      id: speakerId,
      label: speakerLabel,
      color: getSpeakerColor(speakers.length),
      segmentCount: 0,
      totalSpeakingTime: 0,
    })

    setActiveSpeaker(speakerId)
    setNewSpeakerName('')
    setIsExpanded(false)

    // Show success feedback
    setShowSuccess(speakerLabel)
    setTimeout(() => setShowSuccess(null), 2000)
  }, [newSpeakerName, speakers.length, addSpeaker, setActiveSpeaker])

  const handleSelectSpeaker = useCallback((speakerId: string) => {
    setActiveSpeaker(speakerId)
    setIsExpanded(false)

    const speaker = speakers.find(s => s.id === speakerId)
    if (speaker) {
      setShowSuccess(speaker.label)
      setTimeout(() => setShowSuccess(null), 2000)
    }
  }, [speakers, setActiveSpeaker])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddSpeaker()
    } else if (e.key === 'Escape') {
      setIsExpanded(false)
      setNewSpeakerName('')
    }
  }

  if (!isRecording) return null

  const activeSpeaker = speakers.find(s => s.id === activeSpeakerId)

  return (
    <div className="relative">
      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-xs font-medium whitespace-nowrap"
          >
            {showSuccess} spricht
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Button / Expanded View */}
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col gap-2 p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-lg min-w-[240px]"
          >
            {/* Existing Speakers */}
            {speakers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-2 border-b border-[var(--border-subtle)]">
                {speakers.map((speaker, index) => (
                  <button
                    key={speaker.id}
                    onClick={() => handleSelectSpeaker(speaker.id)}
                    className={`
                      flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
                      transition-all hover:scale-105
                      ${activeSpeakerId === speaker.id
                        ? 'bg-[var(--accent)]/20 text-[var(--accent)] ring-1 ring-[var(--accent)]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                      }
                    `}
                    title={`Drücke ${index + 1} für schnelle Auswahl`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: speaker.color }}
                    />
                    {speaker.label}
                    <span className="text-[10px] text-[var(--text-muted)] ml-0.5">
                      {index + 1}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* New Speaker Input */}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newSpeakerName}
                onChange={(e) => setNewSpeakerName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Neuer Sprecher..."
                className="flex-1 px-2 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={handleAddSpeaker}
                disabled={!newSpeakerName.trim()}
                className="px-3 py-1.5 bg-[var(--accent)] text-white rounded-md text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--accent-hover)] transition-colors"
              >
                +
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                setIsExpanded(false)
                setNewSpeakerName('')
              }}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-center"
            >
              Esc zum Schließen
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => setIsExpanded(true)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-xl
              transition-all hover:scale-105
              ${activeSpeaker
                ? 'bg-[var(--bg-elevated)] border border-[var(--border)]'
                : 'bg-[var(--accent)]/10 border border-[var(--accent)]/30'
              }
            `}
            title="Drücke S für Sprecher-Tagging"
          >
            <UserIcon className="w-4 h-4 text-[var(--text-secondary)]" />
            {activeSpeaker ? (
              <span className="flex items-center gap-1.5 text-sm">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: activeSpeaker.color }}
                />
                <span className="text-[var(--text-primary)] font-medium">
                  {activeSpeaker.label}
                </span>
              </span>
            ) : (
              <span className="text-sm text-[var(--accent)]">
                Sprecher taggen (S)
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

'use client'

import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVoiceStore } from '@/stores/voice-store'
import { useAppStore } from '@/stores/app-store'
import { useOutputStore } from '@/stores/output-store'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import { Waveform } from './waveform'
import { getRecorder } from '@/lib/audio/recorder'
import { createKnowledgeEntry, serializeEntry } from '@/lib/knowledge'
import { detectShortcut, isImmediateAction, getModifiedTranscription } from '@/lib/voice/shortcut-detector'
import { createDebouncedFetcher } from '@/lib/context/live-suggestions'
import { ContextSidebar } from '@/components/context/context-sidebar'
import type { EntityType } from '@/types/knowledge'

export function VoiceInput() {
  const {
    voiceMode,
    isRecording,
    duration,
    waveformData,
    partialTranscription,
    error,
    liveSuggestions,
    isLoadingSuggestions,
    startRecording,
    stopRecording,
    setDuration,
    setAudioBlob,
    setWaveformData,
    setError,
    setVoiceMode,
    setTranscription,
    setLiveSuggestions,
    setIsLoadingSuggestions,
    clearSuggestions,
  } = useVoiceStore()

  const { generateOutput } = useOutputStore()
  const { addEntry: addKnowledgeEntry } = useKnowledgeStore()

  const { settings, mode, setMode } = useAppStore()
  const [showHint, setShowHint] = useState(true)
  const [shortcutConfirmation, setShortcutConfirmation] = useState<string | null>(null)

  // Create debounced fetcher for live suggestions
  const debouncedFetcher = useMemo(() => createDebouncedFetcher(300), [])

  // Fetch live suggestions when partial transcription changes
  useEffect(() => {
    if (!isRecording || !partialTranscription || !settings.general.showSuggestions) {
      return
    }

    setIsLoadingSuggestions(true)
    const { entries } = useKnowledgeStore.getState()

    debouncedFetcher.fetch(partialTranscription, mode, entries)
      .then(suggestions => {
        setLiveSuggestions(suggestions)
        setIsLoadingSuggestions(false)
      })

    return () => {
      debouncedFetcher.cancel()
    }
  }, [partialTranscription, isRecording, mode, settings.general.showSuggestions, debouncedFetcher, setLiveSuggestions, setIsLoadingSuggestions])

  // Clear suggestions when recording stops
  useEffect(() => {
    if (!isRecording) {
      clearSuggestions()
    }
  }, [isRecording, clearSuggestions])
  const abortControllerRef = useRef<AbortController | null>(null)

  const handleStartRecording = useCallback(async () => {
    try {
      const recorder = getRecorder({
        silenceThreshold: settings.voice.silenceThreshold,
        silenceDuration: settings.voice.silenceDuration * 1000,
        maxDuration: settings.voice.maxRecordingDuration * 1000,
        onDataAvailable: (data) => {
          setWaveformData(data)
        },
        onSilenceDetected: () => {
          if (settings.voice.autoStopOnSilence) {
            handleStopRecording()
          }
        },
      })

      recorder.setCallbacks({
        onDurationChange: setDuration,
        onStateChange: (state) => {
          if (state.audioBlob) {
            setAudioBlob(state.audioBlob)
          }
        },
      })

      const hasPermission = await recorder.requestPermission()
      if (!hasPermission) {
        setError({
          code: 'MICROPHONE_ACCESS_DENIED',
          message: 'Bitte erlaube den Zugriff auf das Mikrofon.',
        })
        return
      }

      startRecording()
      await recorder.start(settings.voice.inputDevice ?? undefined)
      setShowHint(false)
    } catch (err) {
      setError({
        code: 'UNKNOWN',
        message: err instanceof Error ? err.message : 'Recording failed',
        details: err,
      })
    }
  }, [
    settings.voice,
    startRecording,
    setDuration,
    setAudioBlob,
    setWaveformData,
    setError,
  ])

  const handleStopRecording = useCallback(async () => {
    const recorder = getRecorder()
    stopRecording()
    const blob = await recorder.stop()
    if (!blob) {
      setVoiceMode('idle')
      return
    }

    setAudioBlob(blob)

    // Trigger transcription
    abortControllerRef.current = new AbortController()

    try {
      const formData = new FormData()
      formData.append('audio', blob, 'audio.webm')
      formData.append('language', settings.general.language || 'de')

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Transkription fehlgeschlagen')
      }

      const result = await response.json()

      if (result.success && result.data?.transcription) {
        const transcriptionText = result.data.transcription.text
        setTranscription(result.data.transcription)

        // Detect voice shortcuts first
        const shortcut = detectShortcut(transcriptionText)

        // Handle immediate actions (no generation needed)
        if (isImmediateAction(shortcut.type)) {
          if (shortcut.type === 'store_knowledge') {
            // Store directly to knowledge base
            const entry = createKnowledgeEntry({
              content: shortcut.extractedContent,
              mode,
              source: 'voice',
            })
            addKnowledgeEntry(entry)

            if (window.electronAPI?.knowledge) {
              const serialized = serializeEntry(entry)
              await window.electronAPI.knowledge.add(serialized)
            }

            // Show confirmation
            if (shortcut.confirmationMessage) {
              setShortcutConfirmation(shortcut.confirmationMessage)
              setTimeout(() => setShortcutConfirmation(null), 3000)
            }
            setVoiceMode('idle')
            return
          }

          if (shortcut.type === 'mode_switch' && shortcut.newMode) {
            setMode(shortcut.newMode)
            if (shortcut.confirmationMessage) {
              setShortcutConfirmation(shortcut.confirmationMessage)
              setTimeout(() => setShortcutConfirmation(null), 3000)
            }
            setVoiceMode('idle')
            return
          }

          if (shortcut.type === 'knowledge_delete' && shortcut.extractedTarget) {
            // Delete matching entries from knowledge base
            const { entries, removeEntry } = useKnowledgeStore.getState()
            const targetLower = shortcut.extractedTarget.toLowerCase()
            const matchingEntries = entries.filter(e =>
              e.content.toLowerCase().includes(targetLower)
            )

            for (const entry of matchingEntries) {
              removeEntry(entry.id)
              if (window.electronAPI?.knowledge) {
                await window.electronAPI.knowledge.remove(entry.id)
              }
            }

            if (shortcut.confirmationMessage) {
              setShortcutConfirmation(shortcut.confirmationMessage)
              setTimeout(() => setShortcutConfirmation(null), 3000)
            }
            setVoiceMode('idle')
            return
          }
        }

        // Get the text for generation (possibly modified by shortcut)
        const textForGeneration = shortcut.type !== 'none'
          ? getModifiedTranscription(shortcut)
          : transcriptionText

        // Extract entities and store knowledge (in parallel with output generation)
        const extractAndStore = async () => {
          try {
            const extractResponse = await fetch('/api/knowledge/extract', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: transcriptionText, mode }),
            })

            if (extractResponse.ok) {
              const extractResult = await extractResponse.json()
              if (extractResult.success && extractResult.data?.shouldStore) {
                // Create and store knowledge entry
                const entry = createKnowledgeEntry({
                  content: transcriptionText,
                  mode,
                  entityType: extractResult.data.primaryType as EntityType | undefined,
                  tags: extractResult.data.suggestedTags,
                  source: 'voice',
                })

                // Add to store
                addKnowledgeEntry(entry)

                // Persist to Electron storage
                if (window.electronAPI?.knowledge) {
                  const serialized = serializeEntry(entry)
                  await window.electronAPI.knowledge.add(serialized)
                }
              }
            }
          } catch (extractError) {
            // Don't fail the main flow if extraction fails
          }
        }

        // Run extraction in background, don't block output generation
        extractAndStore()

        // Fetch context from knowledge base before generating
        const { entries } = useKnowledgeStore.getState()
        const { fetchContext } = useOutputStore.getState()
        const contextState = await fetchContext(textForGeneration, mode, entries)

        // Generate output with the transcription and context
        await generateOutput(textForGeneration, mode, contextState.context)
        // Reset voice mode after successful generation
        setVoiceMode('idle')
      } else {
        throw new Error(result.error?.message || 'Keine Transkription erhalten')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setVoiceMode('idle')
        return
      }
      setError({
        code: 'TRANSCRIPTION_FAILED',
        message: err instanceof Error ? err.message : 'Transkription fehlgeschlagen',
        details: err,
      })
    } finally {
      abortControllerRef.current = null
    }
  }, [stopRecording, setAudioBlob, setTranscription, setError, setVoiceMode, settings.general.language, generateOutput, mode, addKnowledgeEntry])

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setVoiceMode('idle')
    setError(null)
  }, [setVoiceMode, setError])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isRecording) {
          handleStopRecording()
        } else if (voiceMode === 'transcribing' || voiceMode === 'processing') {
          handleCancel()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRecording, voiceMode, handleStopRecording, handleCancel])

  // Hotkey from Electron
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return

    const unsubActivate = window.electronAPI.on.hotkeyActivate(() => {
      if (isRecording) {
        handleStopRecording()
      } else {
        handleStartRecording()
      }
    })

    return () => {
      unsubActivate()
    }
  }, [isRecording, handleStartRecording, handleStopRecording])

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="relative flex flex-col items-center justify-center p-8">
      {/* Live Context Sidebar */}
      {settings.general.showSuggestions && (
        <ContextSidebar
          suggestions={liveSuggestions}
          isVisible={isRecording && liveSuggestions.length > 0}
          isLoading={isLoadingSuggestions}
        />
      )}

      {/* Shortcut Confirmation */}
      <AnimatePresence>
        {shortcutConfirmation && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-[var(--accent-subtle)] text-[var(--accent)] rounded-[var(--radius-md)] text-sm font-medium"
          >
            {shortcutConfirmation}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="text-center"
          >
            <div className="w-16 h-16 rounded-full bg-[var(--error-subtle)] flex items-center justify-center mx-auto mb-4">
              <ErrorIcon className="w-8 h-8 text-[var(--error)]" />
            </div>
            <p className="text-[var(--text-primary)] font-medium mb-1">
              Fehler
            </p>
            <p className="text-[var(--text-secondary)] text-sm">
              {error.message}
            </p>
            <button
              onClick={() => setError(null)}
              className="mt-4 text-[var(--accent)] text-sm hover:underline"
            >
              Erneut versuchen
            </button>
          </motion.div>
        ) : isRecording ? (
          <motion.div
            key="recording"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md text-center"
          >
            {/* Recording indicator */}
            <motion.div
              className="recording-dot mx-auto mb-6"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />

            <p className="text-[var(--text-primary)] font-medium mb-2">
              Recording...
            </p>

            {/* Duration */}
            <p className="text-[var(--text-tertiary)] text-sm font-mono mb-6">
              {formatDuration(duration)}
            </p>

            {/* Waveform */}
            {settings.appearance.showWaveform && (
              <Waveform
                data={waveformData}
                isRecording={isRecording}
                className="mb-6"
              />
            )}

            {/* Partial transcription */}
            {partialTranscription && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[var(--text-secondary)] text-sm italic mb-6"
              >
                {partialTranscription}
              </motion.p>
            )}

            {/* Stop hint */}
            <p className="text-[var(--text-muted)] text-xs">
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded text-[var(--text-tertiary)]">
                Esc
              </kbd>{' '}
              zum Abbrechen
            </p>
          </motion.div>
        ) : voiceMode === 'transcribing' ? (
          <motion.div
            key="transcribing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center"
          >
            <div className="w-16 h-16 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center mx-auto mb-4">
              <motion.div
                className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <p className="text-[var(--text-primary)] font-medium">
              Transkribiere...
            </p>
            <button
              onClick={handleCancel}
              className="mt-4 text-[var(--text-secondary)] text-sm hover:text-[var(--text-primary)] transition-colors"
            >
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded text-[var(--text-tertiary)] mr-1">
                Esc
              </kbd>
              Abbrechen
            </button>
          </motion.div>
        ) : voiceMode === 'processing' ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center"
          >
            <div className="w-16 h-16 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center mx-auto mb-4">
              <motion.div
                className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <p className="text-[var(--text-primary)] font-medium">
              Generiere Output...
            </p>
            <button
              onClick={handleCancel}
              className="mt-4 text-[var(--text-secondary)] text-sm hover:text-[var(--text-primary)] transition-colors"
            >
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded text-[var(--text-tertiary)] mr-1">
                Esc
              </kbd>
              Abbrechen
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="text-center"
          >
            {/* Mic button */}
            <motion.button
              onClick={handleStartRecording}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-20 h-20 rounded-full bg-[var(--accent)] flex items-center justify-center mx-auto mb-6 shadow-[var(--shadow-glow)] hover:bg-[var(--accent-hover)] transition-colors"
            >
              <MicIcon className="w-8 h-8 text-white" />
            </motion.button>

            <AnimatePresence>
              {showHint && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <p className="text-[var(--text-secondary)] text-sm mb-2">
                    Klicke oder drücke
                  </p>
                  <kbd className="px-2 py-1 bg-[var(--bg-secondary)] rounded-[var(--radius-sm)] text-[var(--text-tertiary)] text-xs font-mono">
                    ⌘ ⇧ Space
                  </kbd>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Icons
function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  )
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  )
}

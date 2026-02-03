'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Waveform } from '@/components/voice/waveform'
import { MeetingTimer } from './meeting-timer'
import { MeetingControls } from './meeting-controls'
import { LiveTranscript } from './live-transcript'
import { SpeakerTagger } from './speaker-tagger'
import { ExportModal } from './export'
import { useMeetingStore } from '@/stores/meeting-store'
import { useTranscriptStore } from '@/stores/transcript-store'
import { useAppStore } from '@/stores/app-store'
import { useExportStore } from '@/stores/export-store'
import { createMeetingRecorder, type MeetingRecorder } from '@/lib/audio/meeting-recorder'
import { createMeetingTranscriptionService, type MeetingTranscriptionService } from '@/lib/transcription/meeting-transcription-service'
import type { MeetingConfig } from '@/types/meeting'

interface MeetingModeViewProps {
  className?: string
}

export function MeetingModeView({ className = '' }: MeetingModeViewProps) {
  const [audioLevel, setAudioLevel] = useState(0)
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null)
  const [isFinalizingTranscription, setIsFinalizingTranscription] = useState(false)
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false)
  const [lastCompletedMeetingId, setLastCompletedMeetingId] = useState<string | null>(null)
  const recorderRef = useRef<MeetingRecorder | null>(null)
  const transcriptionServiceRef = useRef<MeetingTranscriptionService | null>(null)

  // Export store
  const openExportModal = useExportStore((state) => state.openExportModal)

  // Meeting store
  const {
    currentMeeting,
    status,
    settings,
    liveTranscript,
    meetingHistory,
    startMeeting,
    pauseMeeting,
    resumeMeeting,
    stopMeeting,
    addChunk,
    updateChunkStatus,
    addTranscriptionSegment,
    setLiveTranscript,
    addSpeaker,
    updateDuration,
    setError,
    updateMeetingNotes,
  } = useMeetingStore()

  // Transcript store
  const {
    segments,
    speakers,
    activeSpeakerId,
    isAutoScrollEnabled,
    setAutoScroll,
    addSegment,
    addSpeaker: addTranscriptSpeaker,
    clearTranscript,
  } = useTranscriptStore()

  // App store for mode
  const { mode, settings: appSettings } = useAppStore()

  // Generate waveform data from audio level
  useEffect(() => {
    if (status === 'recording') {
      const data = new Float32Array(64)
      for (let i = 0; i < data.length; i++) {
        data[i] = audioLevel * (0.5 + Math.random() * 0.5)
      }
      setWaveformData(data)
    } else {
      setWaveformData(null)
    }
  }, [audioLevel, status])

  // Update duration while recording
  useEffect(() => {
    if (status !== 'recording' || !currentMeeting) return

    const interval = setInterval(() => {
      const elapsed = (Date.now() - currentMeeting.startedAt.getTime()) / 1000
      updateDuration(elapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [status, currentMeeting, updateDuration])

  // Sync active speaker from transcript store to transcription service
  useEffect(() => {
    if (transcriptionServiceRef.current && activeSpeakerId) {
      transcriptionServiceRef.current.setActiveSpeaker(activeSpeakerId)
    }
  }, [activeSpeakerId])

  // Register new speakers with transcription service
  useEffect(() => {
    if (!transcriptionServiceRef.current) return

    // Register all speakers with the transcription service
    for (const speaker of speakers) {
      transcriptionServiceRef.current.registerSpeaker(speaker)
    }
  }, [speakers])

  const handleStartMeeting = useCallback(async () => {
    // Clear previous transcript
    clearTranscript()

    // Create meeting config
    const config: MeetingConfig = {
      mode,
      enableSpeakerDiarization: settings.enableSpeakerDiarization,
      autoGenerateNotes: settings.autoGenerateNotes,
      saveAudioFile: settings.saveAudioFile,
      language: settings.language,
      audioSources: {
        microphone: true,
        systemAudio: false,
      },
    }

    // Start meeting in store
    const meeting = startMeeting(config)

    // Create transcription service
    transcriptionServiceRef.current = createMeetingTranscriptionService(
      {
        meetingId: meeting.id,
        language: settings.language,
        enableSpeakerDetection: settings.enableSpeakerDiarization,
        groqApiKey: appSettings.api.groqApiKey,
      },
      {
        onSegmentReady: (segment) => {
          addTranscriptionSegment(segment)
          addSegment(segment)
        },
        onSpeakerDetected: (speaker) => {
          addSpeaker(speaker)
          addTranscriptSpeaker(speaker)
        },
        onChunkTranscribed: (chunkId) => {
          updateChunkStatus(chunkId, 'completed')
        },
        onChunkFailed: (chunkId, error) => {
          updateChunkStatus(chunkId, 'failed')
          console.error('Chunk transcription failed:', chunkId, error)
        },
        onTranscriptionProgress: (completed, total) => {
          // Progress tracking
        },
        onLiveText: (text) => {
          setLiveTranscript(text)
        },
      }
    )

    // Create recorder
    recorderRef.current = createMeetingRecorder(meeting.id, settings, config, {
      onChunkReady: (data) => {
        addChunk(data.chunk)
        transcriptionServiceRef.current?.processChunk(data)
      },
      onChunkError: (chunkId, error) => {
        updateChunkStatus(chunkId, 'failed')
        console.error('Chunk recording error:', chunkId, error)
      },
      onRecordingError: (error) => {
        setError({
          code: 'RECORDING_FAILED',
          message: error.message,
          recoverable: false,
        })
      },
      onAudioLevel: setAudioLevel,
      onRecordingStarted: () => {
        console.log('Recording started')
      },
      onRecordingStopped: () => {
        console.log('Recording stopped')
      },
    })

    try {
      await recorderRef.current.start()
    } catch (error) {
      console.error('Failed to start recording:', error)
      setError({
        code: 'RECORDING_FAILED',
        message: error instanceof Error ? error.message : 'Recording failed',
        recoverable: true,
      })
    }
  }, [
    mode,
    settings,
    startMeeting,
    addChunk,
    updateChunkStatus,
    addTranscriptionSegment,
    addSegment,
    addSpeaker,
    addTranscriptSpeaker,
    setLiveTranscript,
    setError,
    clearTranscript,
    appSettings.api.groqApiKey,
  ])

  const handlePauseMeeting = useCallback(() => {
    recorderRef.current?.pause()
    transcriptionServiceRef.current?.pause()
    pauseMeeting()
  }, [pauseMeeting])

  const handleResumeMeeting = useCallback(() => {
    recorderRef.current?.resume()
    transcriptionServiceRef.current?.resume()
    resumeMeeting()
  }, [resumeMeeting])

  const handleStopMeeting = useCallback(async () => {
    // Stop recording - this will finalize the last chunk
    await recorderRef.current?.stop()

    // Show finalizing state
    setIsFinalizingTranscription(true)

    // Wait for all transcriptions to complete (with 2 minute timeout)
    if (transcriptionServiceRef.current) {
      try {
        await transcriptionServiceRef.current.waitForCompletion(120000)
      } catch (error) {
        console.error('Error waiting for transcription completion:', error)
      }
    }

    setIsFinalizingTranscription(false)

    // Now stop the meeting and cleanup
    const result = stopMeeting()

    // Save the completed meeting ID for export option
    if (result?.meeting?.id) {
      setLastCompletedMeetingId(result.meeting.id)

      // Generate AI meeting notes in background
      const meeting = result.meeting
      const transcriptText = meeting.transcriptionSegments
        .map((seg) => seg.text)
        .join(' ')

      if (transcriptText.trim().length > 50) {
        setIsGeneratingNotes(true)

        // Call AI notes generation API
        fetch('/api/meeting-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: transcriptText,
            title: meeting.title,
            participants: meeting.speakers.map((s) => s.name || s.id),
            duration: meeting.duration,
            mode: mode,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.data?.notes) {
              updateMeetingNotes(meeting.id, data.data.notes)
            }
          })
          .catch((error) => {
            console.error('Failed to generate meeting notes:', error)
          })
          .finally(() => {
            setIsGeneratingNotes(false)
          })
      }
    }

    // Cleanup
    recorderRef.current = null
    transcriptionServiceRef.current = null
    setAudioLevel(0)
    setWaveformData(null)

    return result
  }, [stopMeeting, mode, updateMeetingNotes])

  const handleExportMeeting = useCallback(() => {
    if (lastCompletedMeetingId) {
      openExportModal(lastCompletedMeetingId)
    }
  }, [lastCompletedMeetingId, openExportModal])

  const handleDismissExportBanner = useCallback(() => {
    setLastCompletedMeetingId(null)
  }, [])

  const isRecordingOrPaused = status === 'recording' || status === 'paused'

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header with timer and controls */}
      <Card variant="elevated" padding="md" className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[var(--text-secondary)] text-sm">
              Meeting-Modus
            </span>

            {isRecordingOrPaused && currentMeeting && (
              <MeetingTimer
                startTime={currentMeeting.startedAt}
                isPaused={status === 'paused'}
                pausedDuration={currentMeeting.pausedDuration}
              />
            )}
          </div>

          <MeetingControls
            status={status}
            onStart={handleStartMeeting}
            onPause={handlePauseMeeting}
            onResume={handleResumeMeeting}
            onStop={handleStopMeeting}
            isFinalizing={isFinalizingTranscription}
          />
        </div>

        {/* Speaker Tagger - shows during recording */}
        {isRecordingOrPaused && (
          <div className="mt-3 flex justify-center">
            <SpeakerTagger isRecording={status === 'recording'} />
          </div>
        )}

        {/* Waveform */}
        {isRecordingOrPaused && settings.showWaveform && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4"
          >
            <Waveform
              data={waveformData}
              isRecording={status === 'recording'}
              barCount={48}
            />
          </motion.div>
        )}
      </Card>

      {/* Live transcript */}
      <Card variant="default" padding="none" className="flex-1 overflow-hidden">
        {settings.showLiveTranscript ? (
          <LiveTranscript
            segments={segments}
            speakers={speakers}
            liveText={liveTranscript}
            isAutoScrollEnabled={isAutoScrollEnabled}
            onAutoScrollChange={setAutoScroll}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
            <p>Live-Transkript ist deaktiviert</p>
          </div>
        )}
      </Card>

      {/* Stats bar */}
      {isRecordingOrPaused && currentMeeting && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center justify-between text-xs text-[var(--text-muted)]"
        >
          <div className="flex items-center gap-4">
            <span>
              {currentMeeting.metadata.totalChunks} Chunks
            </span>
            <span>
              {currentMeeting.metadata.transcribedChunks} transkribiert
            </span>
            {currentMeeting.metadata.failedChunks > 0 && (
              <span className="text-red-400">
                {currentMeeting.metadata.failedChunks} fehlgeschlagen
              </span>
            )}
          </div>
          <div>
            {currentMeeting.metadata.totalWords} Wörter
            {currentMeeting.metadata.estimatedWordsPerMinute > 0 && (
              <span className="ml-2">
                (~{currentMeeting.metadata.estimatedWordsPerMinute} WPM)
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* Export banner after meeting ends */}
      <AnimatePresence>
        {lastCompletedMeetingId && status === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-4 p-4 rounded-xl bg-gradient-to-r from-[var(--accent)]/10 to-[var(--accent)]/5 border border-[var(--accent)]/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
                  {isGeneratingNotes ? (
                    <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <DocumentIcon className="w-5 h-5 text-[var(--accent)]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {isGeneratingNotes ? 'KI-Notizen werden erstellt...' : 'Meeting abgeschlossen'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {isGeneratingNotes
                      ? 'Zusammenfassung, Kernpunkte und Aufgaben werden generiert'
                      : 'Exportiere das Protokoll als Word-Dokument'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDismissExportBanner}
                  className="px-3 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  disabled={isGeneratingNotes}
                >
                  Später
                </button>
                <button
                  onClick={handleExportMeeting}
                  className="px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isGeneratingNotes}
                >
                  <DownloadIcon className="w-4 h-4" />
                  Exportieren
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <ExportModal />
    </div>
  )
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  )
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  )
}

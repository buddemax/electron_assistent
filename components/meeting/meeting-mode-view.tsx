'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Waveform } from '@/components/voice/waveform'
import { MeetingTimer } from './meeting-timer'
import { MeetingControls } from './meeting-controls'
import { LiveTranscript } from './live-transcript'
import { useMeetingStore } from '@/stores/meeting-store'
import { useTranscriptStore } from '@/stores/transcript-store'
import { useAppStore } from '@/stores/app-store'
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
  const recorderRef = useRef<MeetingRecorder | null>(null)
  const transcriptionServiceRef = useRef<MeetingTranscriptionService | null>(null)

  // Meeting store
  const {
    currentMeeting,
    status,
    settings,
    liveTranscript,
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
  } = useMeetingStore()

  // Transcript store
  const {
    segments,
    speakers,
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

    // Cleanup
    recorderRef.current = null
    transcriptionServiceRef.current = null
    setAudioLevel(0)
    setWaveformData(null)

    return result
  }, [stopMeeting])

  const isRecordingOrPaused = status === 'recording' || status === 'paused'

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header with timer and controls */}
      <Card variant="elevated" padding="md" className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-secondary)] text-sm">
                Meeting-Modus
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  mode === 'work'
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-green-500/10 text-green-400'
                }`}
              >
                {mode === 'work' ? 'Arbeit' : 'Privat'}
              </span>
            </div>

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
    </div>
  )
}

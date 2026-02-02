'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import type { MeetingStatus } from '@/types/meeting'

interface MeetingControlsProps {
  status: MeetingStatus
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  disabled?: boolean
  isFinalizing?: boolean
  className?: string
}

export function MeetingControls({
  status,
  onStart,
  onPause,
  onResume,
  onStop,
  disabled = false,
  isFinalizing = false,
  className = '',
}: MeetingControlsProps) {
  const isRecording = status === 'recording'
  const isPaused = status === 'paused'
  const isIdle = status === 'idle'
  const isProcessing = status === 'processing' || status === 'transcribing' || status === 'generating-notes'

  // Show finalizing state
  if (isFinalizing) {
    return (
      <motion.div
        className={`flex items-center gap-3 ${className}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <LoadingSpinner />
          <span className="text-sm">Transkription wird abgeschlossen...</span>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={`flex items-center gap-3 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {isIdle && (
        <Button
          variant="primary"
          size="lg"
          onClick={onStart}
          disabled={disabled}
          className="gap-2"
        >
          <RecordIcon />
          Meeting starten
        </Button>
      )}

      {isRecording && (
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={onPause}
            disabled={disabled}
            className="gap-2"
          >
            <PauseIcon />
            Pause
          </Button>

          <Button
            variant="ghost"
            size="md"
            onClick={onStop}
            disabled={disabled}
            className="gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <StopIcon />
            Beenden
          </Button>
        </>
      )}

      {isPaused && (
        <>
          <Button
            variant="primary"
            size="md"
            onClick={onResume}
            disabled={disabled}
            className="gap-2"
          >
            <PlayIcon />
            Fortsetzen
          </Button>

          <Button
            variant="ghost"
            size="md"
            onClick={onStop}
            disabled={disabled}
            className="gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <StopIcon />
            Beenden
          </Button>
        </>
      )}

      {isProcessing && (
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <LoadingSpinner />
          <span className="text-sm">
            {status === 'transcribing' && 'Transkription läuft...'}
            {status === 'generating-notes' && 'Notizen werden erstellt...'}
            {status === 'processing' && 'Wird verarbeitet...'}
          </span>
        </div>
      )}
    </motion.div>
  )
}

function RecordIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="text-white"
    >
      <circle cx="8" cy="8" r="6" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <rect x="4" y="3" width="3" height="10" rx="1" />
      <rect x="9" y="3" width="3" height="10" rx="1" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M4 3.5a.5.5 0 0 1 .8-.4l8 5.5a.5.5 0 0 1 0 .8l-8 5.5a.5.5 0 0 1-.8-.4v-11z" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <rect x="3" y="3" width="10" height="10" rx="2" />
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <motion.div
      className="w-4 h-4 border-2 border-[var(--text-muted)] border-t-[var(--accent)] rounded-full"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    />
  )
}

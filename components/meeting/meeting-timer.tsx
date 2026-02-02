'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { formatMeetingDuration } from '@/types/meeting'

interface MeetingTimerProps {
  startTime: Date | null
  isPaused: boolean
  pausedDuration?: number
  className?: string
}

export function MeetingTimer({
  startTime,
  isPaused,
  pausedDuration = 0,
  className = '',
}: MeetingTimerProps) {
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (!startTime || isPaused) return

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime.getTime()) / 1000 - pausedDuration
      setDuration(Math.max(0, elapsed))
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime, isPaused, pausedDuration])

  const formattedTime = formatMeetingDuration(duration)

  return (
    <motion.div
      className={`flex items-center gap-2 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Recording indicator */}
      <motion.div
        className={`w-2 h-2 rounded-full ${isPaused ? 'bg-[var(--text-muted)]' : 'bg-red-500'}`}
        animate={
          isPaused
            ? { opacity: 1 }
            : {
                opacity: [1, 0.5, 1],
              }
        }
        transition={
          isPaused
            ? {}
            : {
                duration: 1,
                repeat: Infinity,
                ease: 'easeInOut',
              }
        }
      />

      {/* Time display */}
      <span className="text-[var(--text-primary)] font-mono text-lg tabular-nums">
        {formattedTime}
      </span>

      {/* Paused indicator */}
      {isPaused && (
        <span className="text-[var(--text-muted)] text-xs uppercase tracking-wide">
          Pausiert
        </span>
      )}
    </motion.div>
  )
}

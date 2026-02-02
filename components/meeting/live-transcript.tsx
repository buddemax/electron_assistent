'use client'

import { useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { TranscriptionSegment, Speaker } from '@/types/meeting'

interface LiveTranscriptProps {
  segments: readonly TranscriptionSegment[]
  speakers: readonly Speaker[]
  liveText?: string
  isAutoScrollEnabled: boolean
  onAutoScrollChange: (enabled: boolean) => void
  className?: string
}

/**
 * Normalize text: fix capitalization and clean up formatting
 */
function normalizeText(text: string): string {
  if (!text || text.trim().length === 0) return text

  let result = text.trim()

  // Capitalize first letter of the text
  result = result.charAt(0).toUpperCase() + result.slice(1)

  // Capitalize letters after sentence-ending punctuation (. ! ?)
  result = result.replace(/([.!?])\s+([a-zäöü])/g, (_, punct, letter) => {
    return `${punct} ${letter.toUpperCase()}`
  })

  // Capitalize "ich" to "Ich" when it appears at the start of a sentence or after punctuation
  result = result.replace(/\bich\b/g, (match, offset) => {
    // Check if it's at the start or after sentence-ending punctuation
    if (offset === 0) return 'Ich'
    const before = result.slice(Math.max(0, offset - 2), offset)
    if (/[.!?]\s*$/.test(before)) return 'Ich'
    return match
  })

  return result
}

/**
 * Merge segments into flowing text paragraphs
 */
function mergeSegmentsToText(segments: readonly TranscriptionSegment[]): string {
  if (segments.length === 0) return ''

  const texts = segments.map((s) => s.text.trim()).filter((t) => t.length > 0)

  // Join with space, avoiding double spaces
  let merged = texts.join(' ').replace(/\s+/g, ' ')

  // Normalize the merged text
  return normalizeText(merged)
}

export function LiveTranscript({
  segments,
  speakers,
  liveText = '',
  isAutoScrollEnabled,
  onAutoScrollChange,
  className = '',
}: LiveTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new segments arrive
  useEffect(() => {
    if (isAutoScrollEnabled && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [segments, liveText, isAutoScrollEnabled])

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

    if (isAtBottom !== isAutoScrollEnabled) {
      onAutoScrollChange(isAtBottom)
    }
  }

  const getSpeaker = (speakerId?: string): Speaker | undefined => {
    if (!speakerId) return undefined
    return speakers.find((s) => s.id === speakerId)
  }

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Group consecutive segments by speaker and merge into paragraphs
  const groupedSegments = useMemo(() => {
    return groupSegmentsBySpeaker(segments).map((group) => ({
      ...group,
      mergedText: mergeSegmentsToText(group.segments),
      startTime: group.segments[0]?.startTime ?? 0,
      endTime: group.segments[group.segments.length - 1]?.endTime ?? 0,
    }))
  }, [segments])

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
        <h3 className="text-[var(--text-primary)] font-medium text-sm">
          Live-Transkript
        </h3>
        <button
          onClick={() => onAutoScrollChange(!isAutoScrollEnabled)}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            isAutoScrollEnabled
              ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          Auto-Scroll {isAutoScrollEnabled ? 'An' : 'Aus'}
        </button>
      </div>

      {/* Transcript content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        <AnimatePresence mode="popLayout">
          {groupedSegments.map((group, groupIndex) => {
            const speaker = getSpeaker(group.speakerId)
            return (
              <motion.div
                key={`group-${groupIndex}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group"
              >
                {/* Speaker label with timestamp */}
                <div className="flex items-center gap-2 mb-1">
                  {speaker && (
                    <>
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: speaker.color }}
                      />
                      <span className="text-xs font-medium text-[var(--text-secondary)]">
                        {speaker.name || speaker.label}
                      </span>
                    </>
                  )}
                  <span className="text-[var(--text-muted)] text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    {formatTime(group.startTime)}
                  </span>
                </div>

                {/* Merged paragraph text */}
                <p className="text-[var(--text-primary)] text-sm leading-relaxed pl-4">
                  {group.mergedText}
                </p>
              </motion.div>
            )
          })}

          {/* Live text (currently being transcribed) */}
          {liveText && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pl-4"
            >
              <p className="text-[var(--text-secondary)] text-sm italic">
                {normalizeText(liveText)}
                <motion.span
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  ▍
                </motion.span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {segments.length === 0 && !liveText && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <MicrophoneIcon className="w-12 h-12 text-[var(--text-muted)] mb-3" />
            <p className="text-[var(--text-secondary)] text-sm">
              Das Transkript erscheint hier während der Aufnahme.
            </p>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function MicrophoneIcon({ className }: { className?: string }) {
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
        d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
      />
    </svg>
  )
}

// Helper to group consecutive segments by speaker
function groupSegmentsBySpeaker(
  segments: readonly TranscriptionSegment[]
): readonly { speakerId: string | undefined; segments: TranscriptionSegment[] }[] {
  if (segments.length === 0) return []

  const groups: { speakerId: string | undefined; segments: TranscriptionSegment[] }[] = []

  let currentGroup: { speakerId: string | undefined; segments: TranscriptionSegment[] } | null =
    null

  for (const segment of segments) {
    if (!currentGroup || currentGroup.speakerId !== segment.speakerId) {
      currentGroup = {
        speakerId: segment.speakerId,
        segments: [segment],
      }
      groups.push(currentGroup)
    } else {
      currentGroup.segments.push(segment)
    }
  }

  return groups
}

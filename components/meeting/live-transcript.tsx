'use client'

import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
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
 * Normalize text: fix capitalization, punctuation spacing, and clean up formatting
 */
function normalizeText(text: string): string {
  if (!text || text.trim().length === 0) return text

  let result = text.trim()

  // Fix multiple spaces
  result = result.replace(/\s+/g, ' ')

  // Fix spacing around punctuation
  result = result.replace(/\s+([.,!?;:])/g, '$1')
  result = result.replace(/([.,!?;:])([A-Za-zÄÖÜäöü])/g, '$1 $2')

  // Capitalize first letter of the text
  result = result.charAt(0).toUpperCase() + result.slice(1)

  // Capitalize letters after sentence-ending punctuation (. ! ?)
  result = result.replace(/([.!?])\s+([a-zäöü])/g, (_, punct, letter) => {
    return `${punct} ${letter.toUpperCase()}`
  })

  // Capitalize "ich" to "Ich" when it appears at the start of a sentence
  result = result.replace(/\bich\b/g, (match, offset) => {
    if (offset === 0) return 'Ich'
    const before = result.slice(Math.max(0, offset - 2), offset)
    if (/[.!?]\s*$/.test(before)) return 'Ich'
    return match
  })

  // Ensure text ends with proper punctuation
  if (!/[.!?]$/.test(result)) {
    result += '.'
  }

  return result
}

/**
 * Split text into paragraphs based on sentence count and length
 */
function splitIntoParagraphs(text: string, maxSentencesPerParagraph = 4): string[] {
  if (!text) return []

  // Split by sentence-ending punctuation while keeping the punctuation
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]

  const paragraphs: string[] = []
  let currentParagraph: string[] = []

  for (const sentence of sentences) {
    currentParagraph.push(sentence.trim())

    // Create new paragraph after reaching sentence limit or if current paragraph is long enough
    if (currentParagraph.length >= maxSentencesPerParagraph) {
      paragraphs.push(currentParagraph.join(' '))
      currentParagraph = []
    }
  }

  // Add remaining sentences
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '))
  }

  return paragraphs
}

/**
 * Merge segments into flowing text paragraphs
 */
function mergeSegmentsToText(segments: readonly TranscriptionSegment[]): string {
  if (segments.length === 0) return ''

  const texts = segments.map((s) => s.text.trim()).filter((t) => t.length > 0)
  let merged = texts.join(' ').replace(/\s+/g, ' ')

  return normalizeText(merged)
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  if (!text) return 0
  return text.split(/\s+/).filter((w) => w.length > 0).length
}

/**
 * Format duration in a human-readable way
 */
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}

/**
 * Format time as MM:SS
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

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

  // Group consecutive segments by speaker and merge into paragraphs
  const groupedSegments = useMemo(() => {
    return groupSegmentsBySpeaker(segments).map((group) => {
      const mergedText = mergeSegmentsToText(group.segments)
      const paragraphs = splitIntoParagraphs(mergedText)
      const startTime = group.segments[0]?.startTime ?? 0
      const endTime = group.segments[group.segments.length - 1]?.endTime ?? 0
      const duration = endTime - startTime
      const wordCount = countWords(mergedText)

      return {
        ...group,
        mergedText,
        paragraphs,
        startTime,
        endTime,
        duration,
        wordCount,
      }
    })
  }, [segments])

  // Total stats
  const totalStats = useMemo(() => {
    const totalWords = groupedSegments.reduce((sum, g) => sum + g.wordCount, 0)
    const totalDuration =
      groupedSegments.length > 0
        ? groupedSegments[groupedSegments.length - 1].endTime - groupedSegments[0].startTime
        : 0
    return { totalWords, totalDuration }
  }, [groupedSegments])

  // Copy group text to clipboard
  const copyToClipboard = useCallback(async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      // Fallback for older browsers
    }
  }, [])

  // Copy all transcript
  const copyAllTranscript = useCallback(async () => {
    const fullText = groupedSegments
      .map((g) => {
        const speaker = getSpeaker(g.speakerId)
        const speakerName = speaker?.name || speaker?.label || 'Sprecher'
        return `[${speakerName}]\n${g.mergedText}`
      })
      .join('\n\n')

    try {
      await navigator.clipboard.writeText(fullText)
      setCopiedIndex(-1) // -1 indicates "all" was copied
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      // Fallback
    }
  }, [groupedSegments, getSpeaker])

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <h3 className="text-[var(--text-primary)] font-medium text-sm">
            Live-Transkript
          </h3>
          {totalStats.totalWords > 0 && (
            <span className="text-[var(--text-muted)] text-xs">
              {totalStats.totalWords} Wörter
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {groupedSegments.length > 0 && (
            <button
              onClick={copyAllTranscript}
              className="text-xs px-2 py-1 rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
              title="Gesamtes Transkript kopieren"
            >
              {copiedIndex === -1 ? (
                <span className="text-green-500">Kopiert!</span>
              ) : (
                <CopyIcon className="w-4 h-4" />
              )}
            </button>
          )}
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
      </div>

      {/* Transcript content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-6"
      >
        <AnimatePresence mode="popLayout">
          {groupedSegments.map((group, groupIndex) => {
            const speaker = getSpeaker(group.speakerId)
            return (
              <motion.div
                key={`group-${groupIndex}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="group relative"
              >
                {/* Speaker header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {speaker && (
                      <div
                        className="w-1.5 h-6 rounded-full"
                        style={{ backgroundColor: speaker.color }}
                      />
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {speaker?.name || speaker?.label || 'Sprecher'}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                        <span>{formatTime(group.startTime)}</span>
                        <span>·</span>
                        <span>{formatDuration(group.duration)}</span>
                        <span>·</span>
                        <span>{group.wordCount} Wörter</span>
                      </div>
                    </div>
                  </div>

                  {/* Copy button for this segment */}
                  <button
                    onClick={() => copyToClipboard(group.mergedText, groupIndex)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-[var(--text-secondary)] p-1.5 rounded hover:bg-[var(--surface-hover)]"
                    title="Abschnitt kopieren"
                  >
                    {copiedIndex === groupIndex ? (
                      <CheckIcon className="w-4 h-4 text-green-500" />
                    ) : (
                      <CopyIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Paragraphs */}
                <div className="space-y-3 pl-3.5 border-l-2 border-[var(--border)] ml-[3px]">
                  {group.paragraphs.map((paragraph, pIndex) => (
                    <p
                      key={`p-${pIndex}`}
                      className="text-[var(--text-primary)] text-sm leading-relaxed"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </motion.div>
            )
          })}

          {/* Live text (currently being transcribed) */}
          {liveText && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pl-3.5 border-l-2 border-[var(--accent)]/50 ml-[3px]"
            >
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                {normalizeText(liveText).replace(/\.$/, '')}
                <motion.span
                  className="inline-block ml-0.5 text-[var(--accent)]"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  |
                </motion.span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {segments.length === 0 && !liveText && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-full bg-[var(--surface-hover)] flex items-center justify-center mb-4">
              <MicrophoneIcon className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <p className="text-[var(--text-secondary)] text-sm font-medium mb-1">
              Bereit für die Aufnahme
            </p>
            <p className="text-[var(--text-muted)] text-xs max-w-[200px]">
              Das Transkript erscheint hier automatisch, sobald die Aufnahme startet.
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

function CopyIcon({ className }: { className?: string }) {
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
        d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
      />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

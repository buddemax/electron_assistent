'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { MeetingNotes, ActionItem } from '@/types/meeting'
import { exportNotesToMarkdown } from '@/lib/meeting/meeting-notes-generator'

interface MeetingNotesViewProps {
  notes: MeetingNotes
  meetingTitle: string
  onClose?: () => void
  className?: string
}

export function MeetingNotesView({
  notes,
  meetingTitle,
  onClose,
  className = '',
}: MeetingNotesViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'keyPoints', 'actionItems'])
  )

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections)
    if (next.has(section)) {
      next.delete(section)
    } else {
      next.add(section)
    }
    setExpandedSections(next)
  }

  const handleCopyMarkdown = () => {
    const markdown = exportNotesToMarkdown(notes, meetingTitle)
    navigator.clipboard.writeText(markdown)
  }

  const handleDownload = () => {
    const markdown = exportNotesToMarkdown(notes, meetingTitle)
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${meetingTitle.replace(/[^a-z0-9]/gi, '_')}_notes.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div>
          <h2 className="text-[var(--text-primary)] font-semibold">
            Meeting-Notizen
          </h2>
          <p className="text-[var(--text-secondary)] text-sm">{meetingTitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopyMarkdown}>
            <CopyIcon />
            Kopieren
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload}>
            <DownloadIcon />
            Download
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <CloseIcon />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary */}
        <NotesSection
          title="Zusammenfassung"
          id="summary"
          isExpanded={expandedSections.has('summary')}
          onToggle={() => toggleSection('summary')}
        >
          <p className="text-[var(--text-primary)] text-sm leading-relaxed">
            {notes.summary}
          </p>
        </NotesSection>

        {/* Key Points */}
        {notes.keyPoints.length > 0 && (
          <NotesSection
            title="Wichtige Punkte"
            id="keyPoints"
            count={notes.keyPoints.length}
            isExpanded={expandedSections.has('keyPoints')}
            onToggle={() => toggleSection('keyPoints')}
          >
            <ul className="space-y-2">
              {notes.keyPoints.map((point, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[var(--text-primary)] text-sm"
                >
                  <span className="text-[var(--accent)]">•</span>
                  {point}
                </li>
              ))}
            </ul>
          </NotesSection>
        )}

        {/* Decisions */}
        {notes.decisions.length > 0 && (
          <NotesSection
            title="Entscheidungen"
            id="decisions"
            count={notes.decisions.length}
            isExpanded={expandedSections.has('decisions')}
            onToggle={() => toggleSection('decisions')}
          >
            <ul className="space-y-2">
              {notes.decisions.map((decision, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[var(--text-primary)] text-sm"
                >
                  <span className="text-green-400">✓</span>
                  {decision}
                </li>
              ))}
            </ul>
          </NotesSection>
        )}

        {/* Action Items */}
        {notes.actionItems.length > 0 && (
          <NotesSection
            title="Aufgaben"
            id="actionItems"
            count={notes.actionItems.length}
            isExpanded={expandedSections.has('actionItems')}
            onToggle={() => toggleSection('actionItems')}
          >
            <div className="space-y-3">
              {notes.actionItems.map((item) => (
                <ActionItemCard key={item.id} item={item} />
              ))}
            </div>
          </NotesSection>
        )}

        {/* Topics */}
        {notes.topics.length > 0 && (
          <NotesSection
            title="Themen"
            id="topics"
            count={notes.topics.length}
            isExpanded={expandedSections.has('topics')}
            onToggle={() => toggleSection('topics')}
          >
            <div className="space-y-3">
              {notes.topics.map((topic) => (
                <div
                  key={topic.id}
                  className="p-3 rounded-lg bg-[var(--bg-tertiary)]"
                >
                  <h4 className="text-[var(--text-primary)] font-medium text-sm">
                    {topic.title}
                  </h4>
                  <p className="text-[var(--text-secondary)] text-sm mt-1">
                    {topic.summary}
                  </p>
                </div>
              ))}
            </div>
          </NotesSection>
        )}

        {/* Open Questions */}
        {notes.openQuestions.length > 0 && (
          <NotesSection
            title="Offene Fragen"
            id="openQuestions"
            count={notes.openQuestions.length}
            isExpanded={expandedSections.has('openQuestions')}
            onToggle={() => toggleSection('openQuestions')}
          >
            <ul className="space-y-2">
              {notes.openQuestions.map((question, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[var(--text-primary)] text-sm"
                >
                  <span className="text-yellow-400">?</span>
                  {question}
                </li>
              ))}
            </ul>
          </NotesSection>
        )}

        {/* Next Steps */}
        {notes.nextSteps.length > 0 && (
          <NotesSection
            title="Nächste Schritte"
            id="nextSteps"
            count={notes.nextSteps.length}
            isExpanded={expandedSections.has('nextSteps')}
            onToggle={() => toggleSection('nextSteps')}
          >
            <ol className="space-y-2 list-decimal list-inside">
              {notes.nextSteps.map((step, i) => (
                <li key={i} className="text-[var(--text-primary)] text-sm">
                  {step}
                </li>
              ))}
            </ol>
          </NotesSection>
        )}

        {/* Participants */}
        {notes.participants.length > 0 && (
          <div className="pt-4 border-t border-[var(--border)]">
            <p className="text-[var(--text-muted)] text-xs">
              <span className="font-medium">Teilnehmer:</span>{' '}
              {notes.participants.join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface NotesSectionProps {
  title: string
  id: string
  count?: number
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function NotesSection({
  title,
  id,
  count,
  isExpanded,
  onToggle,
  children,
}: NotesSectionProps) {
  return (
    <Card variant="default" padding="none">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-[var(--text-primary)] font-medium text-sm">
            {title}
          </h3>
          {count !== undefined && (
            <span className="text-[var(--text-muted)] text-xs">({count})</span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronIcon />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function ActionItemCard({ item }: { item: ActionItem }) {
  const priorityColors = {
    high: 'bg-red-500/10 text-red-400 border-red-500/20',
    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    low: 'bg-green-500/10 text-green-400 border-green-500/20',
  }

  const priorityLabels = {
    high: 'Hoch',
    medium: 'Mittel',
    low: 'Niedrig',
  }

  return (
    <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[var(--text-primary)] text-sm flex-1">{item.task}</p>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium border ${priorityColors[item.priority]}`}
        >
          {priorityLabels[item.priority]}
        </span>
      </div>
      {(item.owner || item.deadline) && (
        <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
          {item.owner && (
            <span className="flex items-center gap-1">
              <UserIcon />
              {item.owner}
            </span>
          )}
          {item.deadline && (
            <span className="flex items-center gap-1">
              <CalendarIcon />
              {item.deadline}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Icons
function CopyIcon() {
  return (
    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

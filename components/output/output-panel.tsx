'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOutputStore } from '@/stores/output-store'
import { OutputTypeBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { resolveDate } from '@/lib/utils/date'

export function OutputPanel() {
  const {
    currentOutput,
    detectedType,
    isGenerating,
  } = useOutputStore()

  const [copied, setCopied] = useState(false)
  const [calendarAdded, setCalendarAdded] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)

  const handleCopy = async () => {
    if (currentOutput?.content.body) {
      await window.electronAPI?.clipboard.write(currentOutput.content.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getEmailData = () => {
    if (!currentOutput?.type || currentOutput.type !== 'email' || !currentOutput.content.structured) {
      return null
    }

    const structured = currentOutput.content.structured as {
      to?: string
      subject?: string
    }

    return {
      to: structured.to || '',
      subject: structured.subject || currentOutput.content.title || '',
      body: currentOutput.content.body || '',
    }
  }

  const handleOpenInMail = async () => {
    const emailData = getEmailData()
    if (!emailData) return

    // Encode body with proper line breaks for mailto
    const encodedBody = encodeURIComponent(emailData.body)
      .replace(/%0A/g, '%0D%0A') // Convert LF to CRLF for better compatibility

    const mailtoUrl = `mailto:${emailData.to}?subject=${encodeURIComponent(emailData.subject)}&body=${encodedBody}`

    if (window.electronAPI?.shell?.openExternal) {
      await window.electronAPI.shell.openExternal(mailtoUrl)
    } else {
      window.location.href = mailtoUrl
    }
  }

  const getCalendarData = () => {
    if (!currentOutput?.type || currentOutput.type !== 'calendar' || !currentOutput.content.structured) {
      return null
    }

    const structured = currentOutput.content.structured as {
      event?: {
        title: string
        date: string
        time: string
        duration: number
        notes?: string
        location?: string
      }
    }

    return structured.event || null
  }

  const handleAddToCalendar = async () => {
    const calendarData = getCalendarData()
    if (!calendarData || !window.electronAPI?.calendar) {
      setCalendarError('Kalender-Integration nicht verfügbar')
      return
    }

    setCalendarError(null)

    // Parse the date and time to create start and end dates
    const startDate = resolveDate(calendarData.date, calendarData.time)
    const endDate = new Date(startDate.getTime() + calendarData.duration * 60 * 1000)

    const result = await window.electronAPI.calendar.createEvent({
      title: calendarData.title,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      notes: calendarData.notes,
      location: calendarData.location,
    })

    if (result.success) {
      setCalendarAdded(true)
      setTimeout(() => setCalendarAdded(false), 3000)
    } else {
      setCalendarError(result.error || 'Fehler beim Erstellen des Termins')
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with type badge */}
      <div className="flex items-center px-3 py-2 border-b border-[var(--border-subtle)]">
        {detectedType && <OutputTypeBadge type={detectedType} />}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full"
            >
              <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[var(--text-secondary)] text-sm">
                Generiere Output...
              </p>
            </motion.div>
          ) : currentOutput ? (
            <motion.div
              key={currentOutput.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Email-specific header */}
              {currentOutput.type === 'email' && currentOutput.content.structured && (
                <div className="space-y-2 pb-3 border-b border-[var(--border-subtle)]">
                  {(currentOutput.content.structured as { to?: string }).to && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[var(--text-muted)] w-12">An:</span>
                      <span className="text-[var(--text-primary)]">
                        {(currentOutput.content.structured as { to: string }).to}
                      </span>
                    </div>
                  )}
                  {currentOutput.content.title && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[var(--text-muted)] w-12">Betreff:</span>
                      <span className="text-[var(--text-primary)] font-medium">
                        {currentOutput.content.title}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Calendar-specific display */}
              {currentOutput.type === 'calendar' && currentOutput.content.structured && (
                <div className="space-y-2">
                  {(() => {
                    const structured = currentOutput.content.structured as {
                      event?: {
                        title: string
                        date: string
                        time: string
                        duration: number
                        location?: string
                      }
                      formatted?: {
                        dateDisplay: string
                        timeDisplay: string
                        durationDisplay: string
                      }
                    }
                    const event = structured.event
                    const formatted = structured.formatted

                    if (!event) return null

                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-md bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                            <CalendarIcon className="w-4 h-4 text-[var(--accent)]" />
                          </div>
                          <h3 className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {event.title}
                          </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs pl-10">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[var(--text-muted)] text-[10px]">📅</span>
                            <span className="text-[var(--text-secondary)]">
                              {formatted?.dateDisplay || event.date}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[var(--text-muted)] text-[10px]">🕐</span>
                            <span className="text-[var(--text-secondary)]">
                              {formatted?.timeDisplay || event.time}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[var(--text-muted)] text-[10px]">⏱</span>
                            <span className="text-[var(--text-secondary)]">
                              {formatted?.durationDisplay || `${event.duration} Min.`}
                            </span>
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[var(--text-muted)] text-[10px]">📍</span>
                              <span className="text-[var(--text-secondary)] truncate">
                                {event.location}
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}

              {/* Title for non-email/calendar types */}
              {currentOutput.type !== 'email' && currentOutput.type !== 'calendar' && currentOutput.content.title && (
                <h2 className="text-lg font-medium text-[var(--text-primary)]">
                  {currentOutput.content.title}
                </h2>
              )}

              {/* Body - hide for calendar if already displayed above */}
              {currentOutput.type !== 'calendar' && (
                <div className="prose prose-sm prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-[var(--text-secondary)] leading-relaxed text-sm">
                    {currentOutput.content.body}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                <span>
                  {currentOutput.metadata.wordCount} Wörter
                </span>
                <span>
                  {new Date(currentOutput.createdAt).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center"
            >
              <p className="text-[var(--text-tertiary)] text-sm">
                Kein Output vorhanden
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      {currentOutput && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-primary)]">
          <Button variant="secondary" size="sm" onClick={handleCopy} className="text-xs px-2 py-1">
            {copied ? (
              <>
                <CheckIcon className="w-3.5 h-3.5 mr-1" />
                Kopiert
              </>
            ) : (
              <>
                <CopyIcon className="w-3.5 h-3.5 mr-1" />
                Kopieren
              </>
            )}
          </Button>

          {currentOutput.type === 'email' && (
            <Button variant="secondary" size="sm" onClick={handleOpenInMail} className="text-xs px-2 py-1">
              <MailIcon className="w-3.5 h-3.5 mr-1" />
              Mail
            </Button>
          )}

          {currentOutput.type === 'calendar' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddToCalendar}
              disabled={calendarAdded}
              className="text-xs px-2 py-1"
            >
              {calendarAdded ? (
                <>
                  <CheckIcon className="w-3.5 h-3.5 mr-1" />
                  Hinzugefügt
                </>
              ) : (
                <>
                  <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                  Kalender
                </>
              )}
            </Button>
          )}

          <Button variant="ghost" size="sm" className="text-xs px-2 py-1">
            <RefreshIcon className="w-3.5 h-3.5 mr-1" />
            Neu
          </Button>

          {calendarError && (
            <span className="text-[10px] text-red-500 ml-auto">{calendarError}</span>
          )}
        </div>
      )}
    </div>
  )
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 7.387v10.478c0 .23-.08.424-.238.576-.158.154-.352.23-.58.23h-8.547v-6.959l1.6 1.229c.101.063.222.094.363.094.142 0 .263-.031.364-.094l6.802-5.22v-.117l-7.166 5.494-1.963-1.51V5.787h8.547c.228 0 .422.076.58.229.158.152.238.346.238.575v.796zM14.635 5.787v6.287l-1.885 1.449V5.787h1.885zm-3.77 0v8.693l-1.886-1.449V5.787h1.886zM7.094 5.787v7.287L.237 7.617v-.035l6.857 5.26v5.828H.818c-.228 0-.422-.076-.58-.23C.08 18.29 0 18.095 0 17.865V7.387c0-.229.08-.423.238-.575.158-.153.352-.229.58-.229h6.276v-.796z"/>
    </svg>
  )
}

function SourceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}

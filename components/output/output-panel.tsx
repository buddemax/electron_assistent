'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOutputStore } from '@/stores/output-store'
import { OutputTypeBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { resolveDate } from '@/lib/utils/date'
import * as microsoftTodo from '@/lib/integrations/microsoft-todo'

export function OutputPanel() {
  const {
    currentOutput,
    detectedType,
    isGenerating,
  } = useOutputStore()

  const [copied, setCopied] = useState(false)
  const [calendarAdded, setCalendarAdded] = useState(false)
  const [calendarError, setCalendarError] = useState<string | null>(null)

  // Todo export states
  const [remindersAdded, setRemindersAdded] = useState(false)
  const [remindersError, setRemindersError] = useState<string | null>(null)
  const [microsoftOpened, setMicrosoftOpened] = useState(false)
  const [microsoftUsedWeb, setMicrosoftUsedWeb] = useState(false)
  const [microsoftError, setMicrosoftError] = useState<string | null>(null)
  const [platform, setPlatform] = useState<string>('darwin')

  // Notes export states
  const [notesAdded, setNotesAdded] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)

  // Check platform on mount
  useEffect(() => {
    const checkPlatform = async () => {
      if (window.electronAPI) {
        const plat = await window.electronAPI.app.getPlatform()
        setPlatform(plat)
      }
    }
    checkPlatform()
  }, [])

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

  // ==================== TODO FUNCTIONS ====================

  const getTodoData = () => {
    if (!currentOutput?.type || currentOutput.type !== 'todo' || !currentOutput.content.structured) {
      return null
    }

    const structured = currentOutput.content.structured as {
      items?: Array<{
        id: string
        text: string
        completed: boolean
      }>
      priority?: 'low' | 'medium' | 'high'
      dueDate?: string
    }

    return {
      items: structured.items || [],
      priority: structured.priority || 'medium',
      dueDate: structured.dueDate,
    }
  }

  const handleAddToReminders = async () => {
    const todoData = getTodoData()
    if (!todoData || todoData.items.length === 0) {
      setRemindersError('Keine Aufgaben gefunden')
      return
    }

    if (!window.electronAPI?.reminders) {
      setRemindersError('Erinnerungen-Integration nicht verfügbar')
      return
    }

    setRemindersError(null)

    // Map todo items to reminder tasks
    const tasks = todoData.items
      .filter(item => !item.completed)
      .map(item => ({
        title: item.text,
        priority: todoData.priority,
        dueDate: todoData.dueDate,
      }))

    if (tasks.length === 0) {
      setRemindersError('Alle Aufgaben bereits erledigt')
      return
    }

    const result = await window.electronAPI.reminders.createTasks(tasks)

    if (result.success) {
      setRemindersAdded(true)
      setTimeout(() => setRemindersAdded(false), 3000)
    } else {
      setRemindersError(result.error || 'Fehler beim Erstellen der Erinnerungen')
    }
  }

  const handleAddToMicrosoftTodo = async () => {
    const todoData = getTodoData()
    if (!todoData || todoData.items.length === 0) {
      setMicrosoftError('Keine Aufgaben gefunden')
      return
    }

    setMicrosoftError(null)

    // Map todo items to Microsoft To Do tasks
    const tasks = todoData.items
      .filter(item => !item.completed)
      .map(item => ({
        title: item.text,
        priority: todoData.priority,
        dueDate: todoData.dueDate,
      }))

    if (tasks.length === 0) {
      setMicrosoftError('Alle Aufgaben bereits erledigt')
      return
    }

    try {
      // Open Microsoft To Do app (native or web fallback)
      const result = await microsoftTodo.openWithTasks(tasks)

      if (result.success) {
        setMicrosoftOpened(true)
        setMicrosoftUsedWeb(result.usedWeb)
        // Show longer if web version was used (user needs to paste)
        setTimeout(() => {
          setMicrosoftOpened(false)
          setMicrosoftUsedWeb(false)
        }, result.usedWeb ? 5000 : 3000)
      } else {
        setMicrosoftError('Microsoft To Do konnte nicht geöffnet werden')
      }
    } catch (error) {
      setMicrosoftError(error instanceof Error ? error.message : 'Unbekannter Fehler')
    }
  }

  // ==================== NOTES FUNCTIONS ====================

  const handleAddToNotes = async () => {
    if (!currentOutput) {
      setNotesError('Kein Output vorhanden')
      return
    }

    if (!window.electronAPI?.notes) {
      setNotesError('Notizen-Integration nicht verfügbar')
      return
    }

    setNotesError(null)

    const title = currentOutput.content.title || 'VoiceOS Notiz'
    const body = currentOutput.content.body

    const result = await window.electronAPI.notes.createNote({
      title,
      body,
    })

    if (result.success) {
      setNotesAdded(true)
      setTimeout(() => setNotesAdded(false), 3000)
    } else {
      setNotesError(result.error || 'Fehler beim Erstellen der Notiz')
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
              className="flex flex-col items-center justify-center h-full gap-4"
            >
              {/* Nicer loading indicator with pulsing dots */}
              <div className="flex items-center gap-2">
                <motion.div
                  className="w-3 h-3 rounded-full bg-[var(--accent)]"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="w-3 h-3 rounded-full bg-[var(--accent)]"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div
                  className="w-3 h-3 rounded-full bg-[var(--accent)]"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                />
              </div>
              <p className="text-[var(--text-secondary)] text-sm font-medium">
                Generiere...
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
                <div className="space-y-3 pb-4 border-b border-[var(--border-subtle)]">
                  {(currentOutput.content.structured as { to?: string }).to && (
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--text-muted)] w-16 text-sm">An:</span>
                      <span className="text-[var(--text-primary)] text-base">
                        {(currentOutput.content.structured as { to: string }).to}
                      </span>
                    </div>
                  )}
                  {currentOutput.content.title && (
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--text-muted)] w-16 text-sm">Betreff:</span>
                      <span className="text-[var(--text-primary)] font-semibold text-base">
                        {currentOutput.content.title}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Todo-specific display */}
              {currentOutput.type === 'todo' && currentOutput.content.structured && (
                <div className="space-y-4">
                  {(() => {
                    const structured = currentOutput.content.structured as {
                      items?: Array<{
                        id: string
                        text: string
                        completed: boolean
                      }>
                      priority?: 'low' | 'medium' | 'high'
                      dueDate?: string
                    }
                    const items = structured.items || []
                    const priority = structured.priority

                    if (items.length === 0) return null

                    const priorityLabels = {
                      low: 'Niedrig',
                      medium: 'Mittel',
                      high: 'Hoch',
                    }

                    const priorityColors = {
                      low: 'text-green-500',
                      medium: 'text-yellow-500',
                      high: 'text-red-500',
                    }

                    return (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                            <TodoIcon className="w-6 h-6 text-[var(--accent)]" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                              {items.length} Aufgabe{items.length !== 1 ? 'n' : ''}
                            </h3>
                            {priority && (
                              <span className={`text-sm ${priorityColors[priority]}`}>
                                Priorität: {priorityLabels[priority]}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2 mt-2">
                          {items.map((item, index) => (
                            <div
                              key={item.id || index}
                              className={`flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] ${
                                item.completed ? 'opacity-50' : ''
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                                item.completed
                                  ? 'bg-[var(--accent)] border-[var(--accent)]'
                                  : 'border-[var(--border)]'
                              }`}>
                                {item.completed && (
                                  <CheckIcon className="w-3 h-3 text-white" />
                                )}
                              </div>
                              <span className={`text-[var(--text-primary)] font-medium ${
                                item.completed ? 'line-through' : ''
                              }`}>
                                {item.text}
                              </span>
                            </div>
                          ))}
                        </div>

                        {structured.dueDate && (
                          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                            <CalendarIcon className="w-4 h-4" />
                            <span>Fällig: {structured.dueDate}</span>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}

              {/* Calendar-specific display */}
              {currentOutput.type === 'calendar' && currentOutput.content.structured && (
                <div className="space-y-4">
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
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                            <CalendarIcon className="w-6 h-6 text-[var(--accent)]" />
                          </div>
                          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                            {event.title}
                          </h3>
                        </div>

                        <div className="grid grid-cols-1 gap-3 pl-15 mt-2">
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                            <span className="text-lg">📅</span>
                            <span className="text-[var(--text-primary)] font-medium">
                              {formatted?.dateDisplay || event.date}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                            <span className="text-lg">🕐</span>
                            <span className="text-[var(--text-primary)] font-medium">
                              {formatted?.timeDisplay || event.time}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                            <span className="text-lg">⏱</span>
                            <span className="text-[var(--text-primary)] font-medium">
                              {formatted?.durationDisplay || `${event.duration} Minuten`}
                            </span>
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                              <span className="text-lg">📍</span>
                              <span className="text-[var(--text-primary)] font-medium">
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

              {/* Title for non-email/calendar/todo types */}
              {currentOutput.type !== 'email' && currentOutput.type !== 'calendar' && currentOutput.type !== 'todo' && currentOutput.content.title && (
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  {currentOutput.content.title}
                </h2>
              )}

              {/* Body - hide for calendar/todo if already displayed above */}
              {currentOutput.type !== 'calendar' && currentOutput.type !== 'todo' && (
                <div className="prose prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-[var(--text-primary)] leading-relaxed text-base">
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

          {/* Todo export buttons */}
          {currentOutput.type === 'todo' && (
            <>
              {/* Apple Reminders - only on macOS */}
              {platform === 'darwin' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAddToReminders}
                  disabled={remindersAdded}
                  className="text-xs px-2 py-1"
                >
                  {remindersAdded ? (
                    <>
                      <CheckIcon className="w-3.5 h-3.5 mr-1" />
                      Hinzugefügt
                    </>
                  ) : (
                    <>
                      <ReminderIcon className="w-3.5 h-3.5 mr-1" />
                      Erinnerungen
                    </>
                  )}
                </Button>
              )}

              {/* Microsoft To Do - cross-platform */}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAddToMicrosoftTodo}
                disabled={microsoftOpened}
                className="text-xs px-2 py-1"
                title="Öffnet Microsoft To Do App"
              >
                {microsoftOpened ? (
                  <>
                    <CheckIcon className="w-3.5 h-3.5 mr-1" />
                    {microsoftUsedWeb ? 'Web geöffnet (Cmd+V)' : 'App geöffnet'}
                  </>
                ) : (
                  <>
                    <MicrosoftIcon className="w-3.5 h-3.5 mr-1" />
                    To Do
                  </>
                )}
              </Button>
            </>
          )}

          {/* Apple Notes - for note type on macOS */}
          {currentOutput.type === 'note' && platform === 'darwin' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddToNotes}
              disabled={notesAdded}
              className="text-xs px-2 py-1"
            >
              {notesAdded ? (
                <>
                  <CheckIcon className="w-3.5 h-3.5 mr-1" />
                  Gespeichert
                </>
              ) : (
                <>
                  <NotesIcon className="w-3.5 h-3.5 mr-1" />
                  Notizen
                </>
              )}
            </Button>
          )}

          <Button variant="ghost" size="sm" className="text-xs px-2 py-1">
            <RefreshIcon className="w-3.5 h-3.5 mr-1" />
            Neu
          </Button>

          {/* Error messages */}
          {calendarError && (
            <span className="text-[10px] text-red-500 ml-auto">{calendarError}</span>
          )}
          {remindersError && (
            <span className="text-[10px] text-red-500 ml-auto">{remindersError}</span>
          )}
          {microsoftError && (
            <span className="text-[10px] text-red-500 ml-auto">{microsoftError}</span>
          )}
          {notesError && (
            <span className="text-[10px] text-red-500 ml-auto">{notesError}</span>
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

function TodoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}

function ReminderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
    </svg>
  )
}

function NotesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  )
}

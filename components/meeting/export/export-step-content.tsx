'use client'

import { useExportStore } from '@/stores/export-store'
import { useMeetingStore } from '@/stores/meeting-store'
import type { ExportContentOptions } from '@/types/export'

interface ContentOption {
  key: keyof ExportContentOptions
  label: string
  description: string
  available: boolean
}

export function ExportStepContent() {
  const { meetingId, contentOptions, updateContentOptions } = useExportStore()
  const getMeetingById = useMeetingStore((state) => state.getMeetingById)

  const meeting = meetingId ? getMeetingById(meetingId) : null
  const notes = meeting?.notes
  const hasTranscript = (meeting?.transcriptionSegments?.length ?? 0) > 0

  const options: ContentOption[] = [
    {
      key: 'includeSummary',
      label: 'Zusammenfassung',
      description: 'AI-generierte Zusammenfassung des Meetings',
      available: !!notes?.summary,
    },
    {
      key: 'includeKeyPoints',
      label: 'Kernpunkte',
      description: 'Die wichtigsten besprochenen Punkte',
      available: !!notes?.keyPoints?.length,
    },
    {
      key: 'includeDecisions',
      label: 'Entscheidungen',
      description: 'Getroffene Entscheidungen im Meeting',
      available: !!notes?.decisions?.length,
    },
    {
      key: 'includeActionItems',
      label: 'Aufgaben',
      description: 'Zugewiesene Aufgaben und To-Dos',
      available: !!notes?.actionItems?.length,
    },
    {
      key: 'includeTopics',
      label: 'Besprochene Themen',
      description: 'Detaillierte Auflistung der Themen',
      available: !!notes?.topics?.length,
    },
    {
      key: 'includeNextSteps',
      label: 'Nächste Schritte',
      description: 'Geplante nächste Schritte',
      available: !!notes?.nextSteps?.length,
    },
    {
      key: 'includeOpenQuestions',
      label: 'Offene Fragen',
      description: 'Noch zu klärende Fragen',
      available: !!notes?.openQuestions?.length,
    },
    {
      key: 'includeFullTranscript',
      label: 'Vollständiges Transkript',
      description: 'Das gesamte wörtliche Transkript',
      available: hasTranscript,
    },
  ]

  const toggleOption = (key: keyof ExportContentOptions) => {
    updateContentOptions({ [key]: !contentOptions[key] })
  }

  const selectAll = () => {
    const updates: Record<string, boolean> = {}
    for (const opt of options) {
      if (opt.available) {
        updates[opt.key] = true
      }
    }
    updateContentOptions(updates as Partial<ExportContentOptions>)
  }

  const selectNone = () => {
    const updates: Record<string, boolean> = {}
    for (const opt of options) {
      updates[opt.key] = false
    }
    updateContentOptions(updates as Partial<ExportContentOptions>)
  }

  const availableCount = options.filter((o) => o.available).length
  const selectedCount = options.filter((o) => o.available && contentOptions[o.key]).length

  return (
    <div className="space-y-6">
      {/* Info text */}
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Wähle aus, welche Inhalte im Protokoll enthalten sein sollen.
      </p>

      {/* No AI notes warning */}
      {!notes && hasTranscript && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Hinweis:</strong> Für dieses Meeting wurden noch keine AI-Notizen generiert.
            Du kannst das Transkript exportieren. AI-Zusammenfassungen werden in einer zukünftigen Version verfügbar sein.
          </p>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={selectAll}
          className="text-sm text-amber-600 dark:text-amber-400 hover:underline font-medium"
        >
          Alle auswählen
        </button>
        <span className="text-neutral-300 dark:text-neutral-600">|</span>
        <button
          onClick={selectNone}
          className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:underline"
        >
          Keine auswählen
        </button>
        <span className="ml-auto text-xs text-neutral-500 dark:text-neutral-400">
          {selectedCount} von {availableCount} ausgewählt
        </span>
      </div>

      {/* Options list */}
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.key}
            className={`
              flex items-start gap-3 p-3 rounded-lg border transition-colors
              ${
                option.available
                  ? contentOptions[option.key]
                    ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                    : 'border-neutral-200 dark:border-neutral-700 hover:border-amber-300 dark:hover:border-amber-600 bg-white dark:bg-neutral-800'
                  : 'border-neutral-200 dark:border-neutral-700 opacity-50 cursor-not-allowed bg-neutral-50 dark:bg-neutral-800/50'
              }
              ${option.available ? 'cursor-pointer' : ''}
            `}
          >
            <input
              type="checkbox"
              checked={contentOptions[option.key]}
              onChange={() => toggleOption(option.key)}
              disabled={!option.available}
              className="
                mt-0.5 w-4 h-4 rounded
                border-neutral-300 dark:border-neutral-600
                text-amber-500
                focus:ring-amber-500
                disabled:opacity-50
              "
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    option.available
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {option.label}
                </span>
                {!option.available && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400">
                    Nicht verfügbar
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {option.description}
              </p>
            </div>
          </label>
        ))}
      </div>

      {/* Transcript warning */}
      {contentOptions.includeFullTranscript && hasTranscript && (
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Hinweis:</strong> Das vollständige Transkript kann das Dokument
            deutlich verlängern. Es eignet sich vor allem für die Archivierung.
          </p>
        </div>
      )}

      {/* No transcript available */}
      {!hasTranscript && (
        <div className="p-4 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Für dieses Meeting ist kein Transkript verfügbar.
          </p>
        </div>
      )}
    </div>
  )
}

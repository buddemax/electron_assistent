'use client'

import { VoiceInputField } from './voice-input-field'
import { useExportStore } from '@/stores/export-store'
import { MEETING_TYPE_LABELS } from '@/types/export'
import type { MeetingType } from '@/types/export'

export function ExportStepDetails() {
  const { config, updateConfig } = useExportStore()

  if (!config) return null

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours} Std. ${minutes} Min.`
    }
    return `${minutes} Minuten`
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <VoiceInputField
        label="Meeting-Titel"
        value={config.title}
        onChange={(title) => updateConfig({ title })}
        placeholder="Titel des Meetings..."
      />

      {/* Meeting Type */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Meeting-Typ
        </label>
        <select
          value={config.meetingType}
          onChange={(e) => updateConfig({ meetingType: e.target.value as MeetingType })}
          className="
            w-full px-3 py-2
            bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600
            rounded-lg text-sm text-neutral-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500
            transition-colors
          "
        >
          {Object.entries(MEETING_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Date & Time (read-only) */}
      <div className="p-4 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">Datum</span>
          <span className="text-neutral-900 dark:text-white font-medium">
            {formatDate(config.date)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">Uhrzeit</span>
          <span className="text-neutral-900 dark:text-white font-medium">
            {formatTime(config.startTime)}
            {config.endTime && ` - ${formatTime(config.endTime)}`}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500 dark:text-neutral-400">Dauer</span>
          <span className="text-neutral-900 dark:text-white font-medium">
            {formatDuration(config.duration)}
          </span>
        </div>
      </div>

      {/* Organization */}
      <VoiceInputField
        label="Organisation / Firma (optional)"
        value={config.organization || ''}
        onChange={(organization) => updateConfig({ organization })}
        placeholder="Name der Organisation..."
      />

      {/* Location */}
      <VoiceInputField
        label="Ort (optional)"
        value={config.location || ''}
        onChange={(location) => updateConfig({ location })}
        placeholder="z.B. Konferenzraum A, Video-Call..."
      />

      {/* Letterhead option */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={config.includeLetterhead}
          onChange={(e) => updateConfig({ includeLetterhead: e.target.checked })}
          className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600 text-amber-500 focus:ring-amber-500"
        />
        <span className="text-sm text-neutral-700 dark:text-neutral-300">
          Firmen-Briefkopf einbinden
        </span>
      </label>
    </div>
  )
}

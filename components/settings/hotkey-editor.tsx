'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import type { HotkeyConfig, HotkeyModifier } from '@/types/settings'

interface HotkeyEditorProps {
  label: string
  description: string
  hotkey: HotkeyConfig
  onChange: (hotkey: HotkeyConfig) => void
}

/**
 * Format a hotkey config for display
 */
function formatHotkey(config: HotkeyConfig): string {
  const parts: string[] = []

  if (config.modifiers.includes('meta')) parts.push('\u2318') // ⌘
  if (config.modifiers.includes('ctrl')) parts.push('\u2303') // ⌃
  if (config.modifiers.includes('alt')) parts.push('\u2325') // ⌥
  if (config.modifiers.includes('shift')) parts.push('\u21E7') // ⇧

  // Format key name for display
  let keyDisplay = config.key
  if (config.key === 'Space') keyDisplay = 'Space'
  else if (config.key === 'Escape') keyDisplay = 'Esc'
  else if (config.key === 'ArrowUp') keyDisplay = '\u2191'
  else if (config.key === 'ArrowDown') keyDisplay = '\u2193'
  else if (config.key === 'ArrowLeft') keyDisplay = '\u2190'
  else if (config.key === 'ArrowRight') keyDisplay = '\u2192'
  else if (config.key.length === 1) keyDisplay = config.key.toUpperCase()

  parts.push(keyDisplay)
  return parts.join(' ')
}

export function HotkeyEditor({ label, description, hotkey, onChange }: HotkeyEditorProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordedKey, setRecordedKey] = useState<HotkeyConfig | null>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isRecording) return

    e.preventDefault()
    e.stopPropagation()

    // Ignore only modifier keys
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return

    const modifiers: HotkeyModifier[] = []
    if (e.metaKey) modifiers.push('meta')
    if (e.ctrlKey) modifiers.push('ctrl')
    if (e.altKey) modifiers.push('alt')
    if (e.shiftKey) modifiers.push('shift')

    // Normalize key
    let key = e.key
    if (key === ' ') key = 'Space'

    setRecordedKey({
      key,
      modifiers,
      enabled: true,
    })
    setIsRecording(false)
  }, [isRecording])

  useEffect(() => {
    if (isRecording) {
      window.addEventListener('keydown', handleKeyDown, true)
      return () => window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isRecording, handleKeyDown])

  const handleSave = () => {
    if (recordedKey) {
      onChange(recordedKey)
      setRecordedKey(null)
    }
  }

  const handleCancel = () => {
    setRecordedKey(null)
    setIsRecording(false)
  }

  const handleStartRecording = () => {
    setRecordedKey(null)
    setIsRecording(true)
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</p>
      </div>

      <div className="flex items-center gap-2">
        {isRecording ? (
          <>
            <kbd className="px-3 py-1.5 bg-[var(--accent)]/10 border border-[var(--accent)] rounded text-xs font-mono text-[var(--accent)] animate-pulse min-w-[80px] text-center">
              Taste...
            </kbd>
            <Button variant="ghost" size="sm" onClick={handleCancel} className="text-xs">
              Abbrechen
            </Button>
          </>
        ) : recordedKey ? (
          <>
            <kbd className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--accent)] rounded text-xs font-mono text-[var(--text-primary)] min-w-[80px] text-center">
              {formatHotkey(recordedKey)}
            </kbd>
            <Button variant="secondary" size="sm" onClick={handleSave} className="text-xs">
              Speichern
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCancel} className="text-xs">
              Abbrechen
            </Button>
          </>
        ) : (
          <>
            <kbd className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded text-xs font-mono text-[var(--text-secondary)] min-w-[80px] text-center">
              {formatHotkey(hotkey)}
            </kbd>
            <Button variant="ghost" size="sm" onClick={handleStartRecording} className="text-xs">
              Ändern
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

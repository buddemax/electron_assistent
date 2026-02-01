'use client'

import { useEffect, useState } from 'react'
import { ModeToggle } from '@/components/ui/toggle'
import { useAppStore } from '@/stores/app-store'

interface TitlebarProps {
  title?: string
}

export function Titlebar({ title = 'VoiceOS' }: TitlebarProps) {
  const { mode, toggleMode, isAlwaysOnTop, setAlwaysOnTop, setSettingsOpen, setKnowledgePanelOpen } = useAppStore()
  const [platform, setPlatform] = useState<NodeJS.Platform>('darwin')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.app.getPlatform().then(setPlatform)
    }
  }, [])

  const handleMinimize = () => {
    window.electronAPI?.window.minimize()
  }

  const handleClose = () => {
    window.electronAPI?.window.close()
  }

  const handleToggleAlwaysOnTop = () => {
    const newValue = !isAlwaysOnTop
    setAlwaysOnTop(newValue)
    window.electronAPI?.window.setAlwaysOnTop(newValue)
  }

  const isMac = platform === 'darwin'

  return (
    <header className="drag-region h-12 flex items-center justify-between px-4 bg-[var(--bg-primary)]/50 border-b border-[var(--border-subtle)]">
      {/* Left side - Traffic lights space on Mac */}
      <div className={`flex items-center gap-3 ${isMac ? 'ml-16' : ''}`}>
        {!isMac && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {title}
            </span>
          </div>
        )}
      </div>

      {/* Center - Mode Toggle */}
      <div className="no-drag">
        <ModeToggle
          mode={mode}
          onChange={(newMode) => {
            if (newMode !== mode) toggleMode()
          }}
        />
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-1 no-drag">
        {/* Always on top button */}
        <button
          onClick={handleToggleAlwaysOnTop}
          className={`
            p-2 rounded-[var(--radius-sm)]
            transition-colors duration-[var(--transition-fast)]
            ${
              isAlwaysOnTop
                ? 'text-[var(--accent)] bg-[var(--accent-subtle)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
            }
          `}
          title={isAlwaysOnTop ? 'Disable always on top' : 'Enable always on top'}
        >
          <PinIcon className="w-4 h-4" />
        </button>

        {/* Knowledge Panel button */}
        <button
          onClick={() => setKnowledgePanelOpen(true)}
          className="p-2 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors duration-[var(--transition-fast)]"
          title="Knowledge Base"
        >
          <DatabaseIcon className="w-4 h-4" />
        </button>

        {/* Settings button */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors duration-[var(--transition-fast)]"
          title="Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        {/* Window controls for non-Mac */}
        {!isMac && (
          <>
            <div className="w-px h-4 bg-[var(--border)] mx-1" />
            <button
              onClick={handleMinimize}
              className="p-2 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors duration-[var(--transition-fast)]"
            >
              <MinimizeIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--error)] hover:bg-[var(--error-subtle)] transition-colors duration-[var(--transition-fast)]"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </header>
  )
}

// Icons
function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function MinimizeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </svg>
  )
}

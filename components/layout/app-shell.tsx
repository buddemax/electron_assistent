'use client'

import { type ReactNode, useEffect } from 'react'
import { Titlebar } from './titlebar'
import { useAppStore } from '@/stores/app-store'
import { useKnowledgePersistence } from '@/lib/knowledge'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { setFocused, setSettingsOpen } = useAppStore()

  // Initialize knowledge persistence - loads entries from Electron store on mount
  useKnowledgePersistence()

  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return

    // Window focus/blur handlers
    const unsubBlur = window.electronAPI.on.windowBlur(() => {
      setFocused(false)
    })

    const unsubFocus = window.electronAPI.on.windowFocus(() => {
      setFocused(true)
    })

    // Settings open handler from tray
    const unsubSettings = window.electronAPI.on.openSettings(() => {
      setSettingsOpen(true)
    })

    return () => {
      unsubBlur()
      unsubFocus()
      unsubSettings()
    }
  }, [setFocused, setSettingsOpen])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      <Titlebar />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}

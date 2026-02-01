'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useAppStore()
  const theme = settings.appearance.theme

  useEffect(() => {
    const root = document.documentElement

    // Remove all theme classes
    root.classList.remove('theme-light', 'theme-system', 'dark')

    if (theme === 'light') {
      root.classList.add('theme-light')
    } else if (theme === 'system') {
      root.classList.add('theme-system')
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        // System is dark, use default dark theme (no class needed)
      } else {
        // System is light, the CSS media query will handle it
      }
    } else {
      // dark theme - default, no class needed
    }

    // Listen for system theme changes when in system mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        // Force a re-render by toggling the class
        root.classList.remove('theme-system')
        void root.offsetWidth // Force reflow
        root.classList.add('theme-system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  return <>{children}</>
}

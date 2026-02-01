import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Mode } from '@/types/output'
import type { AppSettings, DEFAULT_SETTINGS } from '@/types/settings'

interface AppState {
  // Mode
  mode: Mode
  setMode: (mode: Mode) => void
  toggleMode: () => void

  // Settings
  settings: AppSettings
  updateSettings: <K extends keyof AppSettings>(
    key: K,
    value: Partial<AppSettings[K]>
  ) => void
  resetSettings: () => void

  // UI State
  isSettingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  isKnowledgePanelOpen: boolean
  setKnowledgePanelOpen: (open: boolean) => void
  isAlwaysOnTop: boolean
  setAlwaysOnTop: (value: boolean) => void
  isFocused: boolean
  setFocused: (focused: boolean) => void

  // API Keys (separate for security)
  hasValidApiKeys: () => boolean
}

const defaultSettings: AppSettings = {
  general: {
    defaultMode: 'work',
    autoSaveToKnowledge: true,
    showSuggestions: true,
    language: 'de',
    startOnBoot: false,
    showInDock: true,
  },
  voice: {
    inputDevice: null,
    silenceThreshold: 0.01,
    maxRecordingDuration: 120,
    autoStopOnSilence: true,
    silenceDuration: 2,
    playFeedbackSounds: true,
  },
  api: {
    groqApiKey: '',
    geminiApiKey: '',
  },
  appearance: {
    theme: 'dark',
    windowOpacity: 1,
    showWaveform: true,
    compactMode: false,
    alwaysOnTop: false,
    accentColor: '#6366f1',
  },
  hotkeys: {
    activate: {
      key: 'Space',
      modifiers: ['meta', 'shift'],
      enabled: true,
    },
    toggleMode: {
      key: 'M',
      modifiers: ['meta', 'shift'],
      enabled: true,
    },
    stopRecording: {
      key: 'Escape',
      modifiers: [],
      enabled: true,
    },
    copyOutput: {
      key: 'C',
      modifiers: ['meta'],
      enabled: true,
    },
  },
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Mode
      mode: 'work',
      setMode: (mode) => set({ mode }),
      toggleMode: () =>
        set((state) => ({
          mode: state.mode === 'work' ? 'private' : 'work',
        })),

      // Settings
      settings: defaultSettings,
      updateSettings: (key, value) => {
        console.log('[AppStore] updateSettings called:', key, value)
        set((state) => {
          const newSettings = {
            ...state.settings,
            [key]: {
              ...state.settings[key],
              ...value,
            },
          }
          console.log('[AppStore] New settings:', key, newSettings[key])
          return { settings: newSettings }
        })
      },
      resetSettings: () => set({ settings: defaultSettings }),

      // UI State
      isSettingsOpen: false,
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),
      isKnowledgePanelOpen: false,
      setKnowledgePanelOpen: (open) => set({ isKnowledgePanelOpen: open }),
      isAlwaysOnTop: false,
      setAlwaysOnTop: (value) => set({ isAlwaysOnTop: value }),
      isFocused: true,
      setFocused: (focused) => set({ isFocused: focused }),

      // API Keys validation
      hasValidApiKeys: () => {
        const { settings } = get()
        return (
          settings.api.groqApiKey.length > 0 &&
          settings.api.geminiApiKey.length > 0
        )
      },
    }),
    {
      name: 'voiceos-app-store',
      partialize: (state) => ({
        mode: state.mode,
        settings: state.settings,
        isAlwaysOnTop: state.isAlwaysOnTop,
      }),
    }
  )
)

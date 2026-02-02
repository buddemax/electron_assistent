import type { Mode } from './output'
import type { MeetingSettings } from './meeting'
import { DEFAULT_MEETING_SETTINGS } from './meeting'

export interface AppSettings {
  readonly general: GeneralSettings
  readonly voice: VoiceSettings
  readonly api: ApiSettings
  readonly appearance: AppearanceSettings
  readonly hotkeys: HotkeySettings
  readonly meeting: MeetingSettings
}

export interface GeneralSettings {
  readonly defaultMode: Mode
  readonly autoSaveToKnowledge: boolean
  readonly showSuggestions: boolean
  readonly language: 'de' | 'en'
  readonly startOnBoot: boolean
  readonly showInDock: boolean
}

export interface VoiceSettings {
  readonly inputDevice: string | null
  readonly silenceThreshold: number
  readonly maxRecordingDuration: number
  readonly autoStopOnSilence: boolean
  readonly silenceDuration: number
  readonly playFeedbackSounds: boolean
}

export interface ApiSettings {
  readonly groqApiKey: string
  readonly geminiApiKey: string
}

export interface AppearanceSettings {
  readonly theme: 'dark' | 'light' | 'system'
  readonly windowOpacity: number
  readonly showWaveform: boolean
  readonly compactMode: boolean
  readonly alwaysOnTop: boolean
  readonly accentColor: string
}

export interface HotkeySettings {
  readonly activate: HotkeyConfig
  readonly toggleMode: HotkeyConfig
  readonly stopRecording: HotkeyConfig
  readonly copyOutput: HotkeyConfig
}

export interface HotkeyConfig {
  readonly key: string
  readonly modifiers: readonly HotkeyModifier[]
  readonly enabled: boolean
}

export type HotkeyModifier = 'ctrl' | 'alt' | 'shift' | 'meta'

export const DEFAULT_SETTINGS: AppSettings = {
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
  meeting: DEFAULT_MEETING_SETTINGS,
}

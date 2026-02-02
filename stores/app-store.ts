import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Mode } from '@/types/output'
import type { AppSettings } from '@/types/settings'
import type { UserProfile } from '@/types/profile'
import { DEFAULT_USER_PROFILE } from '@/types/profile'
import { DEFAULT_MEETING_SETTINGS } from '@/types/meeting'
import type {
  DailyQuestionsState,
  QuestionAnswer,
  SerializedQuestionAnswer,
} from '@/types/daily-questions'
import {
  DEFAULT_DAILY_QUESTIONS_STATE,
  serializeAnswers,
  deserializeAnswers,
} from '@/types/daily-questions'

export type AppMode = 'voice' | 'meeting'

interface AppState {
  // Mode
  mode: Mode
  setMode: (mode: Mode) => void
  toggleMode: () => void

  // App Mode (Voice vs Meeting)
  appMode: AppMode
  setAppMode: (mode: AppMode) => void

  // Settings
  settings: AppSettings
  updateSettings: <K extends keyof AppSettings>(
    key: K,
    value: Partial<AppSettings[K]>
  ) => void
  resetSettings: () => void

  // User Profile
  profile: UserProfile
  setProfile: (profile: UserProfile) => void
  updateProfileField: <K extends keyof UserProfile>(
    field: K,
    value: UserProfile[K]
  ) => void

  // Onboarding
  onboardingComplete: boolean
  completeOnboarding: () => void
  resetOnboarding: () => void

  // Daily Questions
  dailyQuestions: DailyQuestionsState
  setDailyQuestionsEnabled: (enabled: boolean) => void
  addQuestionAnswer: (answer: QuestionAnswer) => void
  dismissDailyQuestions: () => void
  setSessionQuestions: (questionIds: readonly string[]) => void
  resetDailyQuestionsSession: () => void

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
  meeting: DEFAULT_MEETING_SETTINGS,
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

      // App Mode (Voice vs Meeting)
      appMode: 'voice',
      setAppMode: (appMode) => set({ appMode }),

      // Settings
      settings: defaultSettings,
      updateSettings: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            [key]: {
              ...state.settings[key],
              ...value,
            },
          },
        })),
      resetSettings: () => set({ settings: defaultSettings }),

      // User Profile
      profile: DEFAULT_USER_PROFILE,
      setProfile: (profile) => set({ profile }),
      updateProfileField: (field, value) =>
        set((state) => ({
          profile: {
            ...state.profile,
            [field]: value,
          },
        })),

      // Onboarding
      onboardingComplete: false,
      completeOnboarding: () => set({ onboardingComplete: true }),
      resetOnboarding: () =>
        set({
          onboardingComplete: false,
          profile: DEFAULT_USER_PROFILE,
        }),

      // Daily Questions
      dailyQuestions: DEFAULT_DAILY_QUESTIONS_STATE,
      setDailyQuestionsEnabled: (enabled) =>
        set((state) => ({
          dailyQuestions: {
            ...state.dailyQuestions,
            enabled,
          },
        })),
      addQuestionAnswer: (answer) =>
        set((state) => ({
          dailyQuestions: {
            ...state.dailyQuestions,
            answers: [...state.dailyQuestions.answers, answer],
            askedQuestionIds: state.dailyQuestions.askedQuestionIds.includes(
              answer.questionId
            )
              ? state.dailyQuestions.askedQuestionIds
              : [...state.dailyQuestions.askedQuestionIds, answer.questionId],
          },
        })),
      dismissDailyQuestions: () =>
        set((state) => ({
          dailyQuestions: {
            ...state.dailyQuestions,
            dismissed: true,
            lastSessionDate: new Date().toISOString().split('T')[0],
          },
        })),
      setSessionQuestions: (questionIds) =>
        set((state) => ({
          dailyQuestions: {
            ...state.dailyQuestions,
            currentSessionQuestionIds: questionIds,
            lastSessionDate: new Date().toISOString().split('T')[0],
            dismissed: false,
          },
        })),
      resetDailyQuestionsSession: () =>
        set((state) => ({
          dailyQuestions: {
            ...state.dailyQuestions,
            currentSessionQuestionIds: [],
            dismissed: false,
          },
        })),

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
        profile: state.profile,
        onboardingComplete: state.onboardingComplete,
        dailyQuestions: {
          ...state.dailyQuestions,
          answers: serializeAnswers(state.dailyQuestions.answers),
        },
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppState> & {
          dailyQuestions?: DailyQuestionsState & {
            answers: readonly SerializedQuestionAnswer[]
          }
        }
        return {
          ...currentState,
          ...persisted,
          dailyQuestions: persisted.dailyQuestions
            ? {
                ...persisted.dailyQuestions,
                answers: deserializeAnswers(persisted.dailyQuestions.answers),
              }
            : currentState.dailyQuestions,
        }
      },
    }
  )
)

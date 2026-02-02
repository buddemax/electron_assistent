import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Meeting,
  MeetingStatus,
  MeetingConfig,
  MeetingError,
  MeetingResult,
  MeetingSettings,
  AudioChunk,
  TranscriptionSegment,
  Speaker,
  MeetingNotes,
  SerializedMeeting,
} from '@/types/meeting'
import {
  DEFAULT_MEETING_SETTINGS,
  generateMeetingTitle,
  serializeMeeting,
  deserializeMeeting,
  getSpeakerColor,
} from '@/types/meeting'

interface MeetingStats {
  readonly totalDuration: number
  readonly transcribedDuration: number
  readonly pendingChunks: number
  readonly completedChunks: number
  readonly failedChunks: number
}

interface MeetingState {
  // Current Session
  readonly currentMeeting: Meeting | null
  readonly status: MeetingStatus
  readonly error: MeetingError | null

  // Settings
  readonly settings: MeetingSettings

  // Statistics
  readonly stats: MeetingStats

  // Meeting History
  readonly meetingHistory: readonly Meeting[]

  // Live Data
  readonly liveTranscript: string
  readonly currentChunkIndex: number

  // Actions
  startMeeting: (config: MeetingConfig) => Meeting
  pauseMeeting: () => void
  resumeMeeting: () => void
  stopMeeting: () => MeetingResult | null

  // Chunk Management
  addChunk: (chunk: AudioChunk) => void
  updateChunkStatus: (chunkId: string, status: AudioChunk['status'], transcriptionId?: string) => void
  markChunkFailed: (chunkId: string, retryCount: number) => void

  // Transcription
  addTranscriptionSegment: (segment: TranscriptionSegment) => void
  setLiveTranscript: (text: string) => void
  appendToLiveTranscript: (text: string) => void
  clearLiveTranscript: () => void

  // Speakers
  addSpeaker: (speaker: Speaker) => void
  updateSpeaker: (speakerId: string, updates: Partial<Speaker>) => void

  // Notes
  setMeetingNotes: (notes: MeetingNotes) => void

  // Settings
  updateSettings: (updates: Partial<MeetingSettings>) => void

  // Error Handling
  setError: (error: MeetingError | null) => void
  clearError: () => void

  // History
  getMeetingById: (id: string) => Meeting | null
  deleteMeeting: (id: string) => void
  clearHistory: () => void

  // Duration Tracking
  updateDuration: (duration: number) => void

  // Reset
  reset: () => void
}

const initialStats: MeetingStats = {
  totalDuration: 0,
  transcribedDuration: 0,
  pendingChunks: 0,
  completedChunks: 0,
  failedChunks: 0,
}

const initialState = {
  currentMeeting: null as Meeting | null,
  status: 'idle' as MeetingStatus,
  error: null as MeetingError | null,
  settings: DEFAULT_MEETING_SETTINGS,
  stats: initialStats,
  meetingHistory: [] as readonly Meeting[],
  liveTranscript: '',
  currentChunkIndex: 0,
}

const MAX_HISTORY_ITEMS = 50

export const useMeetingStore = create<MeetingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      startMeeting: (config) => {
        const now = new Date()
        const newMeeting: Meeting = {
          id: crypto.randomUUID(),
          title: config.title || generateMeetingTitle(now),
          mode: config.mode,
          status: 'recording',
          startedAt: now,
          duration: 0,
          pausedDuration: 0,
          chunks: [],
          transcriptionSegments: [],
          speakers: [],
          metadata: {
            totalChunks: 0,
            transcribedChunks: 0,
            failedChunks: 0,
            estimatedWordsPerMinute: 0,
            audioFormat: 'audio/webm',
            sampleRate: 16000,
            totalWords: 0,
          },
        }

        set({
          currentMeeting: newMeeting,
          status: 'recording',
          error: null,
          stats: initialStats,
          liveTranscript: '',
          currentChunkIndex: 0,
        })

        return newMeeting
      },

      pauseMeeting: () => {
        const { currentMeeting } = get()
        if (!currentMeeting || currentMeeting.status !== 'recording') return

        set((state) => ({
          currentMeeting: state.currentMeeting
            ? { ...state.currentMeeting, status: 'paused' }
            : null,
          status: 'paused',
        }))
      },

      resumeMeeting: () => {
        const { currentMeeting } = get()
        if (!currentMeeting || currentMeeting.status !== 'paused') return

        set((state) => ({
          currentMeeting: state.currentMeeting
            ? { ...state.currentMeeting, status: 'recording' }
            : null,
          status: 'recording',
        }))
      },

      stopMeeting: () => {
        const { currentMeeting, settings } = get()
        if (!currentMeeting) return null

        const now = new Date()
        const completedMeeting: Meeting = {
          ...currentMeeting,
          status: 'completed',
          endedAt: now,
        }

        // Add to history
        set((state) => ({
          currentMeeting: null,
          status: 'idle',
          meetingHistory: [completedMeeting, ...state.meetingHistory].slice(0, MAX_HISTORY_ITEMS),
          liveTranscript: '',
          currentChunkIndex: 0,
          stats: initialStats,
        }))

        return {
          meeting: completedMeeting,
        }
      },

      addChunk: (chunk) => {
        set((state) => {
          if (!state.currentMeeting) return state

          return {
            currentMeeting: {
              ...state.currentMeeting,
              chunks: [...state.currentMeeting.chunks, chunk],
              metadata: {
                ...state.currentMeeting.metadata,
                totalChunks: state.currentMeeting.metadata.totalChunks + 1,
              },
            },
            currentChunkIndex: state.currentChunkIndex + 1,
            stats: {
              ...state.stats,
              pendingChunks: state.stats.pendingChunks + 1,
            },
          }
        })
      },

      updateChunkStatus: (chunkId, status, transcriptionId) => {
        set((state) => {
          if (!state.currentMeeting) return state

          const updatedChunks = state.currentMeeting.chunks.map((chunk) =>
            chunk.id === chunkId
              ? { ...chunk, status, transcriptionId }
              : chunk
          )

          const completedChunks = updatedChunks.filter((c) => c.status === 'completed').length
          const failedChunks = updatedChunks.filter((c) => c.status === 'failed').length
          const pendingChunks = updatedChunks.filter(
            (c) => c.status === 'pending' || c.status === 'transcribing'
          ).length

          return {
            currentMeeting: {
              ...state.currentMeeting,
              chunks: updatedChunks,
              metadata: {
                ...state.currentMeeting.metadata,
                transcribedChunks: completedChunks,
                failedChunks,
              },
            },
            stats: {
              ...state.stats,
              completedChunks,
              failedChunks,
              pendingChunks,
            },
          }
        })
      },

      markChunkFailed: (chunkId, retryCount) => {
        set((state) => {
          if (!state.currentMeeting) return state

          const updatedChunks = state.currentMeeting.chunks.map((chunk) =>
            chunk.id === chunkId
              ? { ...chunk, status: 'failed' as const, retryCount }
              : chunk
          )

          return {
            currentMeeting: {
              ...state.currentMeeting,
              chunks: updatedChunks,
            },
          }
        })
      },

      addTranscriptionSegment: (segment) => {
        set((state) => {
          if (!state.currentMeeting) return state

          const existingSegments = state.currentMeeting.transcriptionSegments
          const newSegments = [...existingSegments, segment].sort(
            (a, b) => a.startTime - b.startTime
          )

          // Calculate total words
          const totalWords = newSegments.reduce(
            (sum, seg) => sum + seg.text.split(/\s+/).filter(Boolean).length,
            0
          )

          // Calculate words per minute
          const durationMinutes = state.currentMeeting.duration / 60
          const wordsPerMinute = durationMinutes > 0 ? Math.round(totalWords / durationMinutes) : 0

          return {
            currentMeeting: {
              ...state.currentMeeting,
              transcriptionSegments: newSegments,
              metadata: {
                ...state.currentMeeting.metadata,
                totalWords,
                estimatedWordsPerMinute: wordsPerMinute,
              },
            },
          }
        })
      },

      setLiveTranscript: (text) => {
        set({ liveTranscript: text })
      },

      appendToLiveTranscript: (text) => {
        set((state) => ({
          liveTranscript: state.liveTranscript + ' ' + text,
        }))
      },

      clearLiveTranscript: () => {
        set({ liveTranscript: '' })
      },

      addSpeaker: (speaker) => {
        set((state) => {
          if (!state.currentMeeting) return state

          // Check if speaker already exists
          if (state.currentMeeting.speakers.some((s) => s.id === speaker.id)) {
            return state
          }

          return {
            currentMeeting: {
              ...state.currentMeeting,
              speakers: [...state.currentMeeting.speakers, speaker],
            },
          }
        })
      },

      updateSpeaker: (speakerId, updates) => {
        set((state) => {
          if (!state.currentMeeting) return state

          return {
            currentMeeting: {
              ...state.currentMeeting,
              speakers: state.currentMeeting.speakers.map((speaker) =>
                speaker.id === speakerId ? { ...speaker, ...updates } : speaker
              ),
            },
          }
        })
      },

      setMeetingNotes: (notes) => {
        set((state) => {
          if (!state.currentMeeting) return state

          return {
            currentMeeting: {
              ...state.currentMeeting,
              notes,
            },
          }
        })
      },

      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }))
      },

      setError: (error) => {
        set({ error, status: error ? 'error' : get().status })
      },

      clearError: () => {
        set({ error: null })
      },

      getMeetingById: (id) => {
        const { meetingHistory, currentMeeting } = get()
        if (currentMeeting?.id === id) return currentMeeting
        return meetingHistory.find((m) => m.id === id) ?? null
      },

      deleteMeeting: (id) => {
        set((state) => ({
          meetingHistory: state.meetingHistory.filter((m) => m.id !== id),
        }))
      },

      clearHistory: () => {
        set({ meetingHistory: [] })
      },

      updateDuration: (duration) => {
        set((state) => {
          if (!state.currentMeeting) return state

          return {
            currentMeeting: {
              ...state.currentMeeting,
              duration,
            },
            stats: {
              ...state.stats,
              totalDuration: duration,
            },
          }
        })
      },

      reset: () => {
        set({
          ...initialState,
          settings: get().settings, // Preserve settings
          meetingHistory: get().meetingHistory, // Preserve history
        })
      },
    }),
    {
      name: 'voiceos-meeting-store',
      partialize: (state) => ({
        settings: state.settings,
        meetingHistory: state.meetingHistory,
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null

          const parsed = JSON.parse(str)
          if (parsed.state?.meetingHistory) {
            parsed.state.meetingHistory = (
              parsed.state.meetingHistory as SerializedMeeting[]
            ).map(deserializeMeeting)
          }
          return parsed
        },
        setItem: (name, value) => {
          const toStore = {
            ...value,
            state: {
              ...value.state,
              meetingHistory: (value.state.meetingHistory as Meeting[]).map(
                serializeMeeting
              ),
            },
          }
          localStorage.setItem(name, JSON.stringify(toStore))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)

// Selectors
export const selectCurrentMeeting = (state: MeetingState) => state.currentMeeting
export const selectMeetingStatus = (state: MeetingState) => state.status
export const selectIsRecording = (state: MeetingState) =>
  state.status === 'recording'
export const selectIsPaused = (state: MeetingState) => state.status === 'paused'
export const selectIsInMeeting = (state: MeetingState) =>
  state.status === 'recording' || state.status === 'paused'
export const selectMeetingSettings = (state: MeetingState) => state.settings
export const selectMeetingStats = (state: MeetingState) => state.stats
export const selectMeetingHistory = (state: MeetingState) => state.meetingHistory
export const selectLiveTranscript = (state: MeetingState) => state.liveTranscript

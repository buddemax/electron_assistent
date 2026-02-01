import { create } from 'zustand'
import type { VoiceMode, VoiceError, TranscriptionResult } from '@/types/voice'
import type { LiveSuggestion } from '@/lib/context/live-suggestions'

interface VoiceState {
  // Recording State
  voiceMode: VoiceMode
  setVoiceMode: (mode: VoiceMode) => void

  // Audio Data
  isRecording: boolean
  duration: number
  audioBlob: Blob | null
  waveformData: Float32Array | null

  // Transcription
  transcription: TranscriptionResult | null
  partialTranscription: string

  // Live Suggestions
  liveSuggestions: readonly LiveSuggestion[]
  isLoadingSuggestions: boolean
  setLiveSuggestions: (suggestions: readonly LiveSuggestion[]) => void
  setIsLoadingSuggestions: (loading: boolean) => void
  clearSuggestions: () => void

  // Error Handling
  error: VoiceError | null
  setError: (error: VoiceError | null) => void

  // Actions
  startRecording: () => void
  stopRecording: () => void
  setDuration: (duration: number) => void
  setAudioBlob: (blob: Blob | null) => void
  setWaveformData: (data: Float32Array | null) => void
  setTranscription: (result: TranscriptionResult | null) => void
  setPartialTranscription: (text: string) => void
  reset: () => void
}

const initialState = {
  voiceMode: 'idle' as VoiceMode,
  isRecording: false,
  duration: 0,
  audioBlob: null,
  waveformData: null,
  transcription: null,
  partialTranscription: '',
  liveSuggestions: [] as readonly LiveSuggestion[],
  isLoadingSuggestions: false,
  error: null,
}

export const useVoiceStore = create<VoiceState>()((set) => ({
  ...initialState,

  setVoiceMode: (voiceMode) =>
    set({
      voiceMode,
      isRecording: voiceMode === 'recording',
    }),

  startRecording: () =>
    set({
      voiceMode: 'recording',
      isRecording: true,
      duration: 0,
      audioBlob: null,
      transcription: null,
      partialTranscription: '',
      error: null,
    }),

  stopRecording: () =>
    set({
      voiceMode: 'transcribing',
      isRecording: false,
    }),

  setDuration: (duration) => set({ duration }),

  setAudioBlob: (audioBlob) => set({ audioBlob }),

  setWaveformData: (waveformData) => set({ waveformData }),

  setTranscription: (transcription) =>
    set({
      transcription,
      voiceMode: transcription ? 'processing' : 'idle',
    }),

  setPartialTranscription: (partialTranscription) =>
    set({ partialTranscription }),

  setLiveSuggestions: (liveSuggestions) => set({ liveSuggestions }),

  setIsLoadingSuggestions: (isLoadingSuggestions) => set({ isLoadingSuggestions }),

  clearSuggestions: () => set({ liveSuggestions: [], isLoadingSuggestions: false }),

  setError: (error) =>
    set({
      error,
      voiceMode: error ? 'error' : 'idle',
      isRecording: false,
    }),

  reset: () => set(initialState),
}))

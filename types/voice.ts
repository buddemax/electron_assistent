export interface AudioState {
  readonly isRecording: boolean
  readonly isPaused: boolean
  readonly duration: number
  readonly audioBlob: Blob | null
  readonly waveformData: Float32Array | null
}

export interface TranscriptionResult {
  readonly text: string
  readonly confidence: number
  readonly language: string
  readonly duration: number
  readonly segments: readonly TranscriptionSegment[]
}

export interface TranscriptionSegment {
  readonly start: number
  readonly end: number
  readonly text: string
  readonly confidence: number
}

export interface VoiceShortcut {
  readonly trigger: string
  readonly pattern: RegExp
  readonly outputType: OutputType
  readonly extractData: (match: RegExpMatchArray) => Record<string, string>
}

export type VoiceMode = 'idle' | 'recording' | 'transcribing' | 'processing' | 'error'

export interface VoiceError {
  readonly code: 'MICROPHONE_ACCESS_DENIED' | 'TRANSCRIPTION_FAILED' | 'AUDIO_TOO_SHORT' | 'NETWORK_ERROR' | 'UNKNOWN'
  readonly message: string
  readonly details?: unknown
}

// Re-export OutputType for convenience
import type { OutputType } from './output'
export type { OutputType }

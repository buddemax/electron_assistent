/**
 * Meeting Recording Mode Types
 */

export type MeetingStatus =
  | 'idle'
  | 'initializing'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'transcribing'
  | 'generating-notes'
  | 'completed'
  | 'error'

export interface Meeting {
  readonly id: string
  readonly title: string
  readonly mode: 'private' | 'work'
  readonly status: MeetingStatus
  readonly startedAt: Date
  readonly endedAt?: Date
  readonly duration: number // in Sekunden
  readonly pausedDuration: number // Gesamte Pausenzeit in Sekunden
  readonly chunks: readonly AudioChunk[]
  readonly transcriptionSegments: readonly TranscriptionSegment[]
  readonly speakers: readonly Speaker[]
  readonly notes?: MeetingNotes
  readonly metadata: MeetingMetadata
}

export interface AudioChunk {
  readonly id: string
  readonly meetingId: string
  readonly index: number
  readonly startTime: number // Millisekunden seit Meeting-Start
  readonly endTime: number
  readonly duration: number // in Millisekunden
  readonly status: ChunkStatus
  readonly retryCount: number
  readonly filePath?: string // Lokaler Pfad (nur in Electron)
  readonly blob?: Blob // In-Memory Blob (nur im Browser)
  readonly transcriptionId?: string
}

export type ChunkStatus =
  | 'recording'
  | 'pending'
  | 'transcribing'
  | 'completed'
  | 'failed'

export interface TranscriptionSegment {
  readonly id: string
  readonly chunkId: string
  readonly startTime: number // Millisekunden seit Meeting-Start
  readonly endTime: number
  readonly text: string
  readonly speakerId?: string
  readonly confidence: number
  readonly words?: readonly WordTimestamp[]
}

export interface WordTimestamp {
  readonly word: string
  readonly start: number
  readonly end: number
  readonly confidence: number
}

export interface Speaker {
  readonly id: string
  readonly label: string // "Sprecher 1", "Sprecher 2" oder benutzerdefiniert
  readonly name?: string // Optionaler benutzerdefinierter Name
  readonly color: string
  readonly segmentCount: number
  readonly totalSpeakingTime: number // in Sekunden
}

export interface MeetingNotes {
  readonly summary: string
  readonly keyPoints: readonly string[]
  readonly decisions: readonly string[]
  readonly actionItems: readonly ActionItem[]
  readonly topics: readonly Topic[]
  readonly participants: readonly string[]
  readonly openQuestions: readonly string[]
  readonly nextSteps: readonly string[]
}

export interface ActionItem {
  readonly id: string
  readonly task: string
  readonly owner?: string
  readonly deadline?: string
  readonly priority: 'high' | 'medium' | 'low'
  readonly completed: boolean
}

export interface Topic {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly startTime: number
  readonly endTime: number
}

export interface MeetingMetadata {
  readonly totalChunks: number
  readonly transcribedChunks: number
  readonly failedChunks: number
  readonly estimatedWordsPerMinute: number
  readonly audioFormat: string
  readonly sampleRate: number
  readonly totalWords: number
}

export interface MeetingConfig {
  readonly title?: string
  readonly mode: 'private' | 'work'
  readonly enableSpeakerDiarization: boolean
  readonly autoGenerateNotes: boolean
  readonly saveAudioFile: boolean
  readonly language: string
  readonly audioSources: {
    readonly microphone: boolean
    readonly systemAudio: boolean
  }
}

export interface MeetingSettings {
  /** Chunk-Dauer in Sekunden (Standard: 30) */
  readonly chunkDuration: number
  /** Overlap zwischen Chunks in Sekunden (Standard: 5) */
  readonly chunkOverlap: number
  /** Maximale Meeting-Dauer in Minuten (Standard: 120) */
  readonly maxDuration: number
  /** Speaker-Erkennung aktivieren */
  readonly enableSpeakerDiarization: boolean
  /** Automatische Notizen am Ende generieren */
  readonly autoGenerateNotes: boolean
  /** Audio-Datei speichern */
  readonly saveAudioFile: boolean
  /** Transkriptions-Sprache */
  readonly language: string
  /** Live-Transkript anzeigen */
  readonly showLiveTranscript: boolean
  /** Waveform anzeigen */
  readonly showWaveform: boolean
}

export const DEFAULT_MEETING_SETTINGS: MeetingSettings = {
  chunkDuration: 30,
  chunkOverlap: 5,
  maxDuration: 120,
  enableSpeakerDiarization: true,
  autoGenerateNotes: true,
  saveAudioFile: false,
  language: 'de',
  showLiveTranscript: true,
  showWaveform: true,
}

export interface MeetingError {
  readonly code: MeetingErrorCode
  readonly message: string
  readonly recoverable: boolean
  readonly details?: unknown
}

export type MeetingErrorCode =
  | 'PERMISSION_DENIED'
  | 'RECORDING_FAILED'
  | 'TRANSCRIPTION_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'STORAGE_FAILED'
  | 'NOTES_GENERATION_FAILED'
  | 'UNKNOWN'

export interface MeetingEvent {
  readonly type: MeetingEventType
  readonly meetingId: string
  readonly timestamp: Date
  readonly data?: unknown
}

export type MeetingEventType =
  | 'started'
  | 'paused'
  | 'resumed'
  | 'stopped'
  | 'chunk-created'
  | 'chunk-transcribed'
  | 'chunk-failed'
  | 'speaker-detected'
  | 'notes-generated'
  | 'error'

export interface MeetingResult {
  readonly meeting: Meeting
  readonly audioFilePath?: string
  readonly transcriptFilePath?: string
  readonly notesFilePath?: string
}

// Hilfsfunktionen für Serialisierung
export interface SerializedMeeting extends Omit<Meeting, 'startedAt' | 'endedAt' | 'chunks'> {
  readonly startedAt: string
  readonly endedAt?: string
  readonly chunks: readonly SerializedAudioChunk[]
}

export interface SerializedAudioChunk extends Omit<AudioChunk, 'blob'> {
  // Blob wird nicht serialisiert
}

export function serializeMeeting(meeting: Meeting): SerializedMeeting {
  return {
    ...meeting,
    startedAt: meeting.startedAt.toISOString(),
    endedAt: meeting.endedAt?.toISOString(),
    chunks: meeting.chunks.map(chunk => {
      const { blob, ...rest } = chunk as AudioChunk & { blob?: Blob }
      return rest
    }),
  }
}

export function deserializeMeeting(data: SerializedMeeting): Meeting {
  return {
    ...data,
    startedAt: new Date(data.startedAt),
    endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
    chunks: data.chunks,
  }
}

// Speaker Farben
export const SPEAKER_COLORS = [
  '#6366f1', // Indigo
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#06b6d4', // Cyan
] as const

export function getSpeakerColor(index: number): string {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length]
}

// Meeting-Titel generieren
export function generateMeetingTitle(startTime: Date): string {
  const formatter = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `Meeting ${formatter.format(startTime)}`
}

// Duration formatieren
export function formatMeetingDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

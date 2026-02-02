/**
 * Meeting Recorder
 * Coordinates MediaRecorder with chunk management for long recordings
 * Handles start/stop/pause and chunk-based transcription
 */

import type { AudioChunk, MeetingConfig, MeetingSettings } from '@/types/meeting'
import { AudioChunkManager, createChunkManager, type ChunkData } from './audio-chunk-manager'

export interface MeetingRecorderConfig {
  readonly settings: MeetingSettings
  readonly config: MeetingConfig
  readonly meetingId: string
}

export interface MeetingRecorderEvents {
  onChunkReady: (data: ChunkData) => void
  onChunkError: (chunkId: string, error: Error) => void
  onRecordingError: (error: Error) => void
  onAudioLevel: (level: number) => void
  onRecordingStarted: () => void
  onRecordingStopped: () => void
}

export type RecorderState = 'idle' | 'initializing' | 'recording' | 'paused' | 'stopping' | 'error'

export class MeetingRecorder {
  private readonly config: MeetingRecorderConfig
  private readonly events: MeetingRecorderEvents
  private chunkManager: AudioChunkManager | null = null
  private mediaRecorder: MediaRecorder | null = null
  private audioStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private analyserNode: AnalyserNode | null = null
  private state: RecorderState = 'idle'
  private chunkTimer: ReturnType<typeof setInterval> | null = null
  private firstChunkTimer: ReturnType<typeof setTimeout> | null = null
  private levelTimer: ReturnType<typeof setInterval> | null = null
  private currentChunkBlobs: Blob[] = []
  private initializationBlob: Blob | null = null // Contains webm header from first data event
  private chunkStartTime = 0

  constructor(config: MeetingRecorderConfig, events: MeetingRecorderEvents) {
    this.config = config
    this.events = events
  }

  getState(): RecorderState {
    return this.state
  }

  async start(): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start recording in state: ${this.state}`)
    }

    this.state = 'initializing'

    try {
      // Request microphone access
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      }

      this.audioStream = await navigator.mediaDevices.getUserMedia(constraints)

      // Set up audio analysis for level monitoring
      this.setupAudioAnalysis()

      // Create chunk manager
      this.chunkManager = createChunkManager(
        this.config.meetingId,
        {
          onChunkReady: (data) => this.events.onChunkReady(data),
          onChunkError: (id, err) => this.events.onChunkError(id, err),
        },
        {
          chunkDuration: this.config.settings.chunkDuration,
          chunkOverlap: this.config.settings.chunkOverlap,
          sampleRate: 16000,
        }
      )

      // Create MediaRecorder
      const mimeType = this.getSupportedMimeType()
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType,
        audioBitsPerSecond: 128000,
      })

      this.setupMediaRecorderEvents()

      // Start recording
      this.chunkManager.start()
      this.mediaRecorder.start(1000) // Collect data every 1 second
      this.startChunkTimer()
      this.startLevelMonitoring()

      this.state = 'recording'
      this.chunkStartTime = Date.now()
      this.events.onRecordingStarted()
    } catch (error) {
      this.state = 'error'
      this.cleanup()
      this.events.onRecordingError(error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  async stop(): Promise<readonly AudioChunk[]> {
    if (this.state !== 'recording' && this.state !== 'paused') {
      throw new Error(`Cannot stop recording in state: ${this.state}`)
    }

    this.state = 'stopping'

    // Stop timers
    this.stopChunkTimer()
    this.stopLevelMonitoring()

    // Request any remaining data from MediaRecorder and wait for it
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      // Request final data before stopping
      await new Promise<void>((resolve) => {
        if (!this.mediaRecorder) {
          resolve()
          return
        }

        const handleStop = () => {
          this.mediaRecorder?.removeEventListener('stop', handleStop)
          resolve()
        }

        this.mediaRecorder.addEventListener('stop', handleStop)
        this.mediaRecorder.stop()
      })
    }

    // Finalize current chunk if any data exists
    if (this.currentChunkBlobs.length > 0) {
      await this.finalizeCurrentChunk()
    }

    // Get all chunks
    const chunks = this.chunkManager?.stop() ?? []

    // Cleanup
    this.cleanup()
    this.state = 'idle'
    this.events.onRecordingStopped()

    return chunks
  }

  pause(): void {
    if (this.state !== 'recording') {
      throw new Error(`Cannot pause recording in state: ${this.state}`)
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause()
    }

    this.chunkManager?.pause()
    this.stopChunkTimer()
    this.state = 'paused'
  }

  resume(): void {
    if (this.state !== 'paused') {
      throw new Error(`Cannot resume recording in state: ${this.state}`)
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume()
    }

    this.chunkManager?.resume()
    this.startChunkTimer()
    this.state = 'recording'
  }

  getDuration(): number {
    return this.chunkManager?.getRecordingDuration() ?? 0
  }

  private setupAudioAnalysis(): void {
    if (!this.audioStream) return

    this.audioContext = new AudioContext({ sampleRate: 16000 })
    const source = this.audioContext.createMediaStreamSource(this.audioStream)

    this.analyserNode = this.audioContext.createAnalyser()
    this.analyserNode.fftSize = 256
    source.connect(this.analyserNode)
  }

  private startLevelMonitoring(): void {
    this.levelTimer = setInterval(() => {
      if (!this.analyserNode) return

      const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount)
      this.analyserNode.getByteFrequencyData(dataArray)

      // Calculate average level
      const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length
      const normalizedLevel = average / 255

      this.events.onAudioLevel(normalizedLevel)
    }, 50)
  }

  private stopLevelMonitoring(): void {
    if (this.levelTimer) {
      clearInterval(this.levelTimer)
      this.levelTimer = null
    }
  }

  private setupMediaRecorderEvents(): void {
    if (!this.mediaRecorder) return

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        // The first blob contains the webm header (EBML element, segment info, tracks)
        // We need to preserve this and prepend it to each chunk we create
        if (this.initializationBlob === null) {
          this.initializationBlob = event.data
          console.log(`Captured initialization segment: ${event.data.size} bytes`)
        }
        this.currentChunkBlobs.push(event.data)
      }
    }

    this.mediaRecorder.onerror = (event) => {
      const error = new Error(`MediaRecorder error: ${event.type}`)
      this.events.onRecordingError(error)
    }
  }

  private startChunkTimer(): void {
    // Create chunks at configured intervals
    const chunkIntervalMs = (this.config.settings.chunkDuration - this.config.settings.chunkOverlap) * 1000

    // For the first chunk, use a shorter interval (10 seconds) for quicker feedback
    const firstChunkMs = Math.min(10000, chunkIntervalMs)

    // First chunk timer
    this.firstChunkTimer = setTimeout(async () => {
      if (this.state === 'recording' && this.currentChunkBlobs.length > 0) {
        await this.finalizeCurrentChunk()
      }

      // Then continue with regular intervals
      this.chunkTimer = setInterval(async () => {
        if (this.state === 'recording' && this.currentChunkBlobs.length > 0) {
          await this.finalizeCurrentChunk()
        }
      }, chunkIntervalMs)
    }, firstChunkMs)
  }

  private stopChunkTimer(): void {
    if (this.firstChunkTimer) {
      clearTimeout(this.firstChunkTimer)
      this.firstChunkTimer = null
    }
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer)
      this.chunkTimer = null
    }
  }

  private async finalizeCurrentChunk(): Promise<void> {
    if (this.currentChunkBlobs.length === 0 || !this.chunkManager) return

    const mimeType = this.getSupportedMimeType()
    const endTime = Date.now()

    // For the first chunk, the initialization blob is already included
    // For subsequent chunks, we need to prepend the initialization blob
    // to create a valid webm file
    const isFirstChunk = this.currentChunkBlobs[0] === this.initializationBlob

    let blobsToMerge: Blob[]
    if (isFirstChunk) {
      // First chunk already has the header
      blobsToMerge = this.currentChunkBlobs
    } else if (this.initializationBlob) {
      // Prepend initialization blob to make a valid webm file
      blobsToMerge = [this.initializationBlob, ...this.currentChunkBlobs]
    } else {
      blobsToMerge = this.currentChunkBlobs
    }

    const blob = new Blob(blobsToMerge, { type: mimeType })

    // Validate blob has actual data
    if (blob.size < 1000) {
      console.warn(`Skipping tiny chunk (${blob.size} bytes) - likely no audio data`)
      this.currentChunkBlobs = []
      this.chunkStartTime = endTime
      return
    }

    console.log(`Finalizing chunk: ${blob.size} bytes, type: ${mimeType}, duration: ${endTime - this.chunkStartTime}ms, hasHeader: ${isFirstChunk || !!this.initializationBlob}`)

    await this.chunkManager.processAudioBlob(blob, this.chunkStartTime, endTime)

    // Reset for next chunk (with overlap consideration)
    this.currentChunkBlobs = []
    this.chunkStartTime = endTime - (this.config.settings.chunkOverlap * 1000)
  }

  private getSupportedMimeType(): string {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ]

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType
      }
    }

    return 'audio/webm'
  }

  private cleanup(): void {
    // Stop and cleanup audio stream
    if (this.audioStream) {
      for (const track of this.audioStream.getTracks()) {
        track.stop()
      }
      this.audioStream = null
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
      this.analyserNode = null
    }

    // Reset state
    this.mediaRecorder = null
    this.chunkManager = null
    this.currentChunkBlobs = []
    this.initializationBlob = null
  }
}

/**
 * Create a meeting recorder with given configuration
 */
export function createMeetingRecorder(
  meetingId: string,
  settings: MeetingSettings,
  config: MeetingConfig,
  events: MeetingRecorderEvents
): MeetingRecorder {
  return new MeetingRecorder(
    {
      meetingId,
      settings,
      config,
    },
    events
  )
}

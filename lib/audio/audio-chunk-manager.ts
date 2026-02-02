/**
 * Audio Chunk Manager
 * Handles chunking of audio data for long recordings
 * Implements overlap strategy and memory management
 */

import type { AudioChunk } from '@/types/meeting'

export interface AudioChunkManagerConfig {
  readonly chunkDuration: number // in seconds
  readonly chunkOverlap: number // in seconds
  readonly sampleRate: number
  readonly meetingId: string
}

export interface ChunkData {
  readonly chunk: AudioChunk
  readonly blob: Blob
}

export interface AudioChunkManagerEvents {
  onChunkReady: (data: ChunkData) => void
  onChunkError: (chunkId: string, error: Error) => void
}

export class AudioChunkManager {
  private readonly config: AudioChunkManagerConfig
  private readonly events: AudioChunkManagerEvents
  private chunks: AudioChunk[] = []
  private currentChunkIndex = 0
  private recordingStartTime = 0
  private lastChunkEndTime = 0
  private audioBuffers: Float32Array[] = []
  private isRecording = false

  constructor(config: AudioChunkManagerConfig, events: AudioChunkManagerEvents) {
    this.config = config
    this.events = events
  }

  start(): void {
    this.recordingStartTime = Date.now()
    this.lastChunkEndTime = 0
    this.currentChunkIndex = 0
    this.chunks = []
    this.audioBuffers = []
    this.isRecording = true
  }

  stop(): readonly AudioChunk[] {
    this.isRecording = false

    // Finalize any remaining audio data as a final chunk
    if (this.audioBuffers.length > 0) {
      this.finalizeCurrentChunk()
    }

    return this.chunks
  }

  pause(): void {
    this.isRecording = false
  }

  resume(): void {
    this.isRecording = true
  }

  /**
   * Process incoming audio data
   * Called periodically with new audio samples
   */
  processAudioData(audioData: Float32Array): void {
    if (!this.isRecording) return

    this.audioBuffers.push(new Float32Array(audioData))

    const totalSamples = this.getTotalBufferedSamples()
    const bufferedDuration = totalSamples / this.config.sampleRate

    // Check if we have enough data for a chunk
    if (bufferedDuration >= this.config.chunkDuration) {
      this.finalizeCurrentChunk()
    }
  }

  /**
   * Process a complete audio blob (alternative to streaming)
   * Used when MediaRecorder provides complete blobs
   */
  async processAudioBlob(blob: Blob, startTime: number, endTime: number): Promise<void> {
    if (!this.isRecording) return

    const chunk = this.createChunk(startTime, endTime, blob)
    this.chunks.push(chunk)

    this.events.onChunkReady({
      chunk,
      blob,
    })

    this.currentChunkIndex++
    this.lastChunkEndTime = endTime
  }

  getChunks(): readonly AudioChunk[] {
    return this.chunks
  }

  getCurrentChunkIndex(): number {
    return this.currentChunkIndex
  }

  getRecordingDuration(): number {
    return (Date.now() - this.recordingStartTime) / 1000
  }

  private getTotalBufferedSamples(): number {
    return this.audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0)
  }

  private finalizeCurrentChunk(): void {
    const totalSamples = this.getTotalBufferedSamples()
    if (totalSamples === 0) return

    // Merge all buffers
    const mergedBuffer = this.mergeBuffers()

    // Calculate timestamps
    const startTime = this.lastChunkEndTime
    const duration = mergedBuffer.length / this.config.sampleRate
    const endTime = startTime + duration * 1000

    // Convert to blob
    const blob = this.float32ToWavBlob(mergedBuffer)

    const chunk = this.createChunk(startTime, endTime, blob)
    this.chunks.push(chunk)

    this.events.onChunkReady({
      chunk,
      blob,
    })

    // Keep overlap samples for next chunk
    const overlapSamples = Math.floor(this.config.chunkOverlap * this.config.sampleRate)
    if (overlapSamples > 0 && mergedBuffer.length > overlapSamples) {
      const overlapBuffer = new Float32Array(overlapSamples)
      overlapBuffer.set(mergedBuffer.slice(mergedBuffer.length - overlapSamples))
      this.audioBuffers = [overlapBuffer]
    } else {
      this.audioBuffers = []
    }

    this.currentChunkIndex++
    this.lastChunkEndTime = endTime - (this.config.chunkOverlap * 1000) // Overlap
  }

  private mergeBuffers(): Float32Array {
    const totalLength = this.getTotalBufferedSamples()
    const merged = new Float32Array(totalLength)

    let offset = 0
    for (const buffer of this.audioBuffers) {
      merged.set(buffer, offset)
      offset += buffer.length
    }

    return merged
  }

  private createChunk(startTime: number, endTime: number, blob?: Blob): AudioChunk {
    return {
      id: crypto.randomUUID(),
      meetingId: this.config.meetingId,
      index: this.currentChunkIndex,
      startTime,
      endTime,
      duration: endTime - startTime,
      status: 'pending',
      retryCount: 0,
      blob,
    }
  }

  private float32ToWavBlob(samples: Float32Array): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)

    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // Subchunk1Size
    view.setUint16(20, 1, true) // AudioFormat (PCM)
    view.setUint16(22, 1, true) // NumChannels
    view.setUint32(24, this.config.sampleRate, true) // SampleRate
    view.setUint32(28, this.config.sampleRate * 2, true) // ByteRate
    view.setUint16(32, 2, true) // BlockAlign
    view.setUint16(34, 16, true) // BitsPerSample
    writeString(36, 'data')
    view.setUint32(40, samples.length * 2, true)

    // Convert samples to 16-bit PCM
    let offset = 44
    for (const sample of samples) {
      const s = Math.max(-1, Math.min(1, sample))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      offset += 2
    }

    return new Blob([buffer], { type: 'audio/wav' })
  }
}

/**
 * Create chunk manager with default meeting settings
 */
export function createChunkManager(
  meetingId: string,
  events: AudioChunkManagerEvents,
  settings?: Partial<AudioChunkManagerConfig>
): AudioChunkManager {
  const config: AudioChunkManagerConfig = {
    chunkDuration: settings?.chunkDuration ?? 30,
    chunkOverlap: settings?.chunkOverlap ?? 5,
    sampleRate: settings?.sampleRate ?? 16000,
    meetingId,
  }

  return new AudioChunkManager(config, events)
}

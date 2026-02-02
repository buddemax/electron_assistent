/**
 * Meeting Transcription Service
 * Coordinates chunked transcription with meeting state
 * Handles speaker detection and transcript assembly
 */

import type { TranscriptionSegment, Speaker } from '@/types/meeting'
import type { ChunkData } from '@/lib/audio/audio-chunk-manager'
import {
  TranscriptionQueue,
  createTranscriptionQueue,
  type TranscriptionResult,
  type TranscriptionQueueEvents,
} from './transcription-queue'

export interface MeetingTranscriptionConfig {
  readonly meetingId: string
  readonly language: string
  readonly enableSpeakerDetection: boolean
}

export interface MeetingTranscriptionEvents {
  onSegmentReady: (segment: TranscriptionSegment) => void
  onSpeakerDetected: (speaker: Speaker) => void
  onChunkTranscribed: (chunkId: string) => void
  onChunkFailed: (chunkId: string, error: Error) => void
  onTranscriptionProgress: (completed: number, total: number) => void
  onLiveText: (text: string) => void
}

interface ChunkInfo {
  readonly chunkId: string
  readonly startTime: number
  readonly endTime: number
}

export class MeetingTranscriptionService {
  private readonly config: MeetingTranscriptionConfig
  private readonly events: MeetingTranscriptionEvents
  private readonly queue: TranscriptionQueue
  private readonly chunkInfoMap = new Map<string, ChunkInfo>()
  private readonly transcribedChunks = new Set<string>()
  private totalChunks = 0
  private currentSpeakerId: string | null = null
  private speakerCounter = 0
  private readonly speakers = new Map<string, Speaker>()

  constructor(config: MeetingTranscriptionConfig, events: MeetingTranscriptionEvents) {
    this.config = config
    this.events = events

    const queueEvents: TranscriptionQueueEvents = {
      onTaskCompleted: (_, result) => this.handleTranscriptionComplete(result),
      onTaskFailed: (taskId, error, willRetry) => this.handleTranscriptionFailed(taskId, error, willRetry),
      onQueueEmpty: () => this.handleQueueEmpty(),
      onRateLimited: (waitMs) => this.handleRateLimited(waitMs),
    }

    this.queue = createTranscriptionQueue(queueEvents)
  }

  /**
   * Set the active speaker for subsequent segments
   * This is called when the user manually tags a speaker
   */
  setActiveSpeaker(speakerId: string | null): void {
    this.currentSpeakerId = speakerId
  }

  /**
   * Register an externally created speaker (from SpeakerTagger)
   */
  registerSpeaker(speaker: Speaker): void {
    if (!this.speakers.has(speaker.id)) {
      this.speakers.set(speaker.id, speaker)
      this.speakerCounter = Math.max(this.speakerCounter, this.speakers.size)
    }
  }

  /**
   * Process a new audio chunk for transcription
   */
  processChunk(data: ChunkData): void {
    const { chunk, blob } = data

    // Store chunk info for later use
    this.chunkInfoMap.set(chunk.id, {
      chunkId: chunk.id,
      startTime: chunk.startTime,
      endTime: chunk.endTime,
    })

    this.totalChunks++

    // Add to transcription queue
    this.queue.enqueue({
      chunkId: chunk.id,
      blob,
      language: this.config.language,
      priority: chunk.index, // Process in order
      retryCount: 0,
      maxRetries: 3,
    })
  }

  /**
   * Pause transcription processing
   */
  pause(): void {
    this.queue.pause()
  }

  /**
   * Resume transcription processing
   */
  resume(): void {
    this.queue.resume()
  }

  /**
   * Get current transcription status
   */
  getStatus(): {
    pending: number
    inProgress: number
    completed: number
    total: number
  } {
    const queueStatus = this.queue.getStatus()
    return {
      pending: queueStatus.pending,
      inProgress: queueStatus.inProgress,
      completed: this.transcribedChunks.size,
      total: this.totalChunks,
    }
  }

  /**
   * Check if all transcriptions are complete
   */
  isComplete(): boolean {
    return this.queue.isComplete()
  }

  /**
   * Wait for all transcriptions to complete
   * @param timeoutMs Maximum time to wait (default 60 seconds)
   */
  async waitForCompletion(timeoutMs = 60000): Promise<void> {
    console.log(`Waiting for transcription completion... (${this.totalChunks - this.transcribedChunks.size} remaining)`)
    await this.queue.waitForCompletion(timeoutMs)
    console.log('Transcription complete')
  }

  /**
   * Get all detected speakers
   */
  getSpeakers(): readonly Speaker[] {
    return Array.from(this.speakers.values())
  }

  private handleTranscriptionComplete(result: TranscriptionResult): void {
    const chunkInfo = this.chunkInfoMap.get(result.chunkId)
    if (!chunkInfo) return

    this.transcribedChunks.add(result.chunkId)

    // Update live text
    this.events.onLiveText(result.text)

    // Convert to transcription segments
    if (result.segments && result.segments.length > 0) {
      for (const seg of result.segments) {
        const segment = this.createSegment(result.chunkId, chunkInfo, seg)
        this.events.onSegmentReady(segment)
      }
    } else {
      // Single segment for entire chunk
      const segment = this.createSegment(result.chunkId, chunkInfo, {
        start: 0,
        end: result.duration,
        text: result.text,
      })
      this.events.onSegmentReady(segment)
    }

    this.events.onChunkTranscribed(result.chunkId)
    this.events.onTranscriptionProgress(this.transcribedChunks.size, this.totalChunks)
  }

  private createSegment(
    chunkId: string,
    chunkInfo: ChunkInfo,
    seg: { start: number; end: number; text: string }
  ): TranscriptionSegment {
    // Adjust timestamps to meeting time
    const absoluteStartTime = chunkInfo.startTime + seg.start * 1000
    const absoluteEndTime = chunkInfo.startTime + seg.end * 1000

    // Detect speaker (heuristic: long pauses indicate speaker change)
    const speakerId = this.config.enableSpeakerDetection
      ? this.detectSpeaker(seg.text, absoluteStartTime)
      : undefined

    return {
      id: crypto.randomUUID(),
      chunkId,
      startTime: absoluteStartTime,
      endTime: absoluteEndTime,
      text: seg.text.trim(),
      speakerId,
      confidence: 0.9, // Groq doesn't provide confidence, use default
    }
  }

  private detectSpeaker(text: string, startTime: number): string {
    // If user has manually set an active speaker, use that
    // This takes priority over automatic detection
    if (this.currentSpeakerId && this.speakers.has(this.currentSpeakerId)) {
      return this.currentSpeakerId
    }

    // Check for explicit speaker indicators in text
    const speakerMatch = text.match(/^\[?(Speaker\s*\d+|Sprecher\s*\d+)\]?:/i)
    if (speakerMatch) {
      const label = speakerMatch[1]
      return this.getOrCreateSpeaker(label).id
    }

    // Create a new speaker if none exists
    if (!this.currentSpeakerId) {
      const speaker = this.createNewSpeaker()
      this.currentSpeakerId = speaker.id
      return speaker.id
    }

    return this.currentSpeakerId
  }

  private getOrCreateSpeaker(label: string): Speaker {
    // Check if speaker with this label exists
    for (const speaker of this.speakers.values()) {
      if (speaker.label.toLowerCase() === label.toLowerCase()) {
        return speaker
      }
    }

    // Create new speaker
    return this.createNewSpeaker(label)
  }

  private createNewSpeaker(label?: string): Speaker {
    this.speakerCounter++
    const id = crypto.randomUUID()

    const speaker: Speaker = {
      id,
      label: label || `Sprecher ${this.speakerCounter}`,
      color: this.getSpeakerColor(this.speakerCounter - 1),
      segmentCount: 0,
      totalSpeakingTime: 0,
    }

    this.speakers.set(id, speaker)
    this.events.onSpeakerDetected(speaker)

    return speaker
  }

  private getSpeakerColor(index: number): string {
    const colors = [
      '#6366f1', // Indigo
      '#22c55e', // Green
      '#f59e0b', // Amber
      '#ec4899', // Pink
      '#8b5cf6', // Violet
      '#14b8a6', // Teal
      '#f97316', // Orange
      '#06b6d4', // Cyan
    ]
    return colors[index % colors.length]
  }

  private handleTranscriptionFailed(taskId: string, error: Error, willRetry: boolean): void {
    // Find chunk ID from task
    // The taskId in queue is different from chunkId, need to track this
    console.error(`Transcription failed for task ${taskId}:`, error.message, willRetry ? '(will retry)' : '')

    if (!willRetry) {
      this.events.onChunkFailed(taskId, error)
    }
  }

  private handleQueueEmpty(): void {
    // All transcription complete
    this.events.onTranscriptionProgress(this.transcribedChunks.size, this.totalChunks)
  }

  private handleRateLimited(waitMs: number): void {
    console.log(`Rate limited, waiting ${waitMs}ms`)
  }
}

/**
 * Create a meeting transcription service
 */
export function createMeetingTranscriptionService(
  config: MeetingTranscriptionConfig,
  events: MeetingTranscriptionEvents
): MeetingTranscriptionService {
  return new MeetingTranscriptionService(config, events)
}

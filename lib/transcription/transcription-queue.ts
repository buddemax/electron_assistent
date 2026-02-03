/**
 * Transcription Queue
 * Rate-limited queue for Groq API transcription requests
 * Handles retries, prioritization, and concurrent request management
 */

export interface TranscriptionTask {
  readonly id: string
  readonly chunkId: string
  readonly blob: Blob
  readonly language: string
  readonly apiKey?: string
  readonly priority: number // Lower = higher priority
  readonly retryCount: number
  readonly maxRetries: number
  readonly addedAt: number
}

export interface TranscriptionResult {
  readonly chunkId: string
  readonly text: string
  readonly segments?: readonly TranscriptionSegment[]
  readonly duration: number
}

export interface TranscriptionSegment {
  readonly start: number
  readonly end: number
  readonly text: string
}

export interface TranscriptionQueueConfig {
  readonly maxConcurrent: number
  readonly requestsPerMinute: number
  readonly retryDelayMs: number
  readonly maxRetries: number
}

export interface TranscriptionQueueEvents {
  onTaskCompleted: (taskId: string, result: TranscriptionResult) => void
  onTaskFailed: (taskId: string, error: Error, willRetry: boolean) => void
  onQueueEmpty: () => void
  onRateLimited: (waitMs: number) => void
}

const DEFAULT_CONFIG: TranscriptionQueueConfig = {
  maxConcurrent: 3,
  requestsPerMinute: 50, // Stay under Groq's 60/min limit
  retryDelayMs: 2000,
  maxRetries: 3,
}

export class TranscriptionQueue {
  private readonly config: TranscriptionQueueConfig
  private readonly events: TranscriptionQueueEvents
  private readonly queue: TranscriptionTask[] = []
  private readonly inProgress = new Map<string, TranscriptionTask>()
  private readonly requestTimestamps: number[] = []
  private isProcessing = false
  private isPaused = false

  constructor(events: TranscriptionQueueEvents, config?: Partial<TranscriptionQueueConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.events = events
  }

  /**
   * Add a transcription task to the queue
   */
  enqueue(task: Omit<TranscriptionTask, 'id' | 'addedAt'>): string {
    const id = crypto.randomUUID()
    const fullTask: TranscriptionTask = {
      ...task,
      id,
      addedAt: Date.now(),
    }

    // Insert by priority (lower number = higher priority)
    const insertIndex = this.queue.findIndex((t) => t.priority > fullTask.priority)
    if (insertIndex === -1) {
      this.queue.push(fullTask)
    } else {
      this.queue.splice(insertIndex, 0, fullTask)
    }

    this.processQueue()
    return id
  }

  /**
   * Remove a task from the queue
   */
  dequeue(taskId: string): boolean {
    const index = this.queue.findIndex((t) => t.id === taskId)
    if (index !== -1) {
      this.queue.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.isPaused = true
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.isPaused = false
    this.processQueue()
  }

  /**
   * Clear all pending tasks
   */
  clear(): void {
    this.queue.length = 0
  }

  /**
   * Get queue status
   */
  getStatus(): {
    pending: number
    inProgress: number
    isPaused: boolean
  } {
    return {
      pending: this.queue.length,
      inProgress: this.inProgress.size,
      isPaused: this.isPaused,
    }
  }

  /**
   * Check if the queue is empty and no tasks are in progress
   */
  isComplete(): boolean {
    return this.queue.length === 0 && this.inProgress.size === 0
  }

  /**
   * Wait for all current tasks to complete
   * @param timeoutMs Maximum time to wait (default 60 seconds)
   */
  async waitForCompletion(timeoutMs = 60000): Promise<void> {
    const startTime = Date.now()

    while (!this.isComplete()) {
      if (Date.now() - startTime > timeoutMs) {
        console.warn('Transcription queue timeout - some tasks may not have completed')
        break
      }
      await this.sleep(500)
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.isPaused) return
    this.isProcessing = true

    try {
      while (this.queue.length > 0 && !this.isPaused) {
        // Check if we can start more tasks
        if (this.inProgress.size >= this.config.maxConcurrent) {
          break
        }

        // Check rate limit
        const waitTime = this.getRateLimitWaitTime()
        if (waitTime > 0) {
          this.events.onRateLimited(waitTime)
          await this.sleep(waitTime)
          continue
        }

        const task = this.queue.shift()
        if (!task) break

        this.inProgress.set(task.id, task)
        this.recordRequest()

        // Process task without waiting (concurrent execution)
        this.processTask(task).catch(() => {
          // Error handling done in processTask
        })
      }

      if (this.queue.length === 0 && this.inProgress.size === 0) {
        this.events.onQueueEmpty()
      }
    } finally {
      this.isProcessing = false
    }
  }

  private async processTask(task: TranscriptionTask): Promise<void> {
    try {
      const result = await this.transcribeChunk(task)

      this.inProgress.delete(task.id)
      this.events.onTaskCompleted(task.id, result)

      // Continue processing queue
      this.processQueue()
    } catch (error) {
      this.inProgress.delete(task.id)

      const willRetry = task.retryCount < task.maxRetries
      this.events.onTaskFailed(
        task.id,
        error instanceof Error ? error : new Error(String(error)),
        willRetry
      )

      if (willRetry) {
        // Re-add with incremented retry count
        await this.sleep(this.config.retryDelayMs * (task.retryCount + 1))
        this.enqueue({
          ...task,
          retryCount: task.retryCount + 1,
          priority: task.priority + 1, // Lower priority on retry
        })
      }

      // Continue processing queue
      this.processQueue()
    }
  }

  private async transcribeChunk(task: TranscriptionTask): Promise<TranscriptionResult> {
    // Validate blob before processing
    if (!task.blob || task.blob.size === 0) {
      throw new Error('Invalid audio blob: empty or missing data')
    }

    const formData = new FormData()

    // Send blob directly with filename (same approach as working voice-input)
    // This avoids potential issues with File constructor corrupting the audio data
    formData.append('audio', task.blob, 'audio.webm')
    formData.append('language', task.language)

    console.log(`Sending chunk ${task.chunkId} for transcription: ${task.blob.size} bytes, type: ${task.blob.type}`)

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      headers: {
        ...(task.apiKey ? { 'x-groq-api-key': task.apiKey } : {}),
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Transcription API error for chunk ${task.chunkId}:`, errorText)
      throw new Error(`Transcription failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // API returns { success: true, data: { transcription: { text, segments } } }
    if (!data.success) {
      throw new Error(data.error?.message || 'Transcription failed')
    }

    const transcription = data.data?.transcription

    return {
      chunkId: task.chunkId,
      text: transcription?.text || '',
      segments: transcription?.segments?.map((seg: { start: number; end: number; text: string }) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })),
      duration: transcription?.duration || 0,
    }
  }

  private getRateLimitWaitTime(): number {
    const now = Date.now()
    const windowStart = now - 60000 // 1 minute window

    // Remove old timestamps
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < windowStart) {
      this.requestTimestamps.shift()
    }

    if (this.requestTimestamps.length >= this.config.requestsPerMinute) {
      // Need to wait until oldest request falls out of window
      const oldestTimestamp = this.requestTimestamps[0]
      return oldestTimestamp + 60000 - now + 100 // Add small buffer
    }

    return 0
  }

  private recordRequest(): void {
    this.requestTimestamps.push(Date.now())
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Create a transcription queue with events
 */
export function createTranscriptionQueue(
  events: TranscriptionQueueEvents,
  config?: Partial<TranscriptionQueueConfig>
): TranscriptionQueue {
  return new TranscriptionQueue(events, config)
}

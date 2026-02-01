export interface RecorderOptions {
  onDataAvailable?: (data: Float32Array) => void
  onSilenceDetected?: () => void
  silenceThreshold?: number
  silenceDuration?: number
  maxDuration?: number
}

export interface RecorderState {
  isRecording: boolean
  duration: number
  audioBlob: Blob | null
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private startTime: number = 0
  private durationInterval: ReturnType<typeof setInterval> | null = null
  private silenceTimeout: ReturnType<typeof setTimeout> | null = null
  private options: RecorderOptions

  private onDurationChange?: (duration: number) => void
  private onStateChange?: (state: Partial<RecorderState>) => void

  constructor(options: RecorderOptions = {}) {
    this.options = {
      silenceThreshold: options.silenceThreshold ?? 0.01,
      silenceDuration: options.silenceDuration ?? 2000,
      maxDuration: options.maxDuration ?? 120000,
      ...options,
    }
  }

  setCallbacks(callbacks: {
    onDurationChange?: (duration: number) => void
    onStateChange?: (state: Partial<RecorderState>) => void
  }) {
    this.onDurationChange = callbacks.onDurationChange
    this.onStateChange = callbacks.onStateChange
  }

  async requestPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      return true
    } catch {
      return false
    }
  }

  async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((device) => device.kind === 'audioinput')
  }

  async start(deviceId?: string): Promise<void> {
    if (this.mediaRecorder?.state === 'recording') {
      return
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
      }

      this.stream = await navigator.mediaDevices.getUserMedia(constraints)
      this.audioContext = new AudioContext()

      const source = this.audioContext.createMediaStreamSource(this.stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      source.connect(this.analyser)

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.getSupportedMimeType(),
      })

      this.chunks = []
      this.startTime = Date.now()

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.chunks, {
          type: this.getSupportedMimeType(),
        })
        this.onStateChange?.({ audioBlob, isRecording: false })
      }

      this.mediaRecorder.start(100) // Collect data every 100ms
      this.onStateChange?.({ isRecording: true })

      // Start duration tracking
      this.durationInterval = setInterval(() => {
        const duration = (Date.now() - this.startTime) / 1000
        this.onDurationChange?.(duration)

        // Check max duration
        if (this.options.maxDuration && duration * 1000 >= this.options.maxDuration) {
          this.stop()
        }
      }, 100)

      // Start waveform and silence detection
      this.startWaveformAnalysis()
    } catch (error) {
      throw new Error(
        `Failed to start recording: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  private startWaveformAnalysis(): void {
    if (!this.analyser) return

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Float32Array(bufferLength)
    let silenceStart: number | null = null

    const analyze = () => {
      if (!this.analyser || this.mediaRecorder?.state !== 'recording') {
        return
      }

      this.analyser.getFloatTimeDomainData(dataArray)

      // Send waveform data
      this.options.onDataAvailable?.(dataArray.slice())

      // Detect silence
      const rms = Math.sqrt(
        dataArray.reduce((sum, val) => sum + val * val, 0) / bufferLength
      )

      if (rms < (this.options.silenceThreshold ?? 0.01)) {
        if (silenceStart === null) {
          silenceStart = Date.now()
        } else if (
          Date.now() - silenceStart >= (this.options.silenceDuration ?? 2000)
        ) {
          this.options.onSilenceDetected?.()
          silenceStart = null
        }
      } else {
        silenceStart = null
      }

      requestAnimationFrame(analyze)
    }

    analyze()
  }

  async stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (this.durationInterval) {
        clearInterval(this.durationInterval)
        this.durationInterval = null
      }

      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout)
        this.silenceTimeout = null
      }

      if (this.mediaRecorder?.state === 'recording') {
        this.mediaRecorder.onstop = () => {
          const audioBlob = new Blob(this.chunks, {
            type: this.getSupportedMimeType(),
          })
          this.cleanup()
          this.onStateChange?.({ audioBlob, isRecording: false })
          resolve(audioBlob)
        }
        this.mediaRecorder.stop()
      } else {
        this.cleanup()
        resolve(null)
      }
    })
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    this.analyser = null
    this.mediaRecorder = null
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }

    return 'audio/webm'
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  getDuration(): number {
    if (!this.startTime) return 0
    return (Date.now() - this.startTime) / 1000
  }
}

// Singleton instance
let recorderInstance: AudioRecorder | null = null

export function getRecorder(options?: RecorderOptions): AudioRecorder {
  if (!recorderInstance) {
    recorderInstance = new AudioRecorder(options)
  }
  return recorderInstance
}

import Groq from 'groq-sdk'
import type { TranscriptionResult, TranscriptionSegment } from '@/types/voice'

let groqClient: Groq | null = null

export function getGroqClient(apiKey?: string): Groq {
  const key = apiKey || process.env.GROQ_API_KEY
  if (!key) {
    throw new Error('GROQ_API_KEY is not configured')
  }

  if (!groqClient || apiKey) {
    groqClient = new Groq({ apiKey: key })
  }

  return groqClient
}

export interface TranscribeOptions {
  language?: string
  prompt?: string
  temperature?: number
}

export async function transcribeAudio(
  audioBlob: Blob,
  apiKey: string,
  options: TranscribeOptions = {}
): Promise<TranscriptionResult> {
  const client = getGroqClient(apiKey)

  // Convert Blob to File for the API
  const audioFile = new File([audioBlob], 'audio.webm', {
    type: audioBlob.type || 'audio/webm',
  })

  const response = await client.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-large-v3',
    language: options.language || 'de',
    prompt: options.prompt,
    temperature: options.temperature ?? 0,
    response_format: 'verbose_json',
  })

  // Parse response into our format
  // Cast to any because verbose_json returns additional fields not in the base type
  const verboseResponse = response as unknown as {
    text: string
    segments?: Array<{ start?: number; end?: number; text?: string; avg_logprob?: number }>
    language?: string
    duration?: number
  }

  const segments: TranscriptionSegment[] = (verboseResponse.segments || []).map(
    (seg) => ({
      start: seg.start ?? 0,
      end: seg.end ?? 0,
      text: seg.text ?? '',
      confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : 0.9,
    })
  )

  return {
    text: verboseResponse.text,
    confidence: segments.length > 0
      ? segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length
      : 0.9,
    language: verboseResponse.language || options.language || 'de',
    duration: verboseResponse.duration ?? 0,
    segments,
  }
}

// For streaming transcription (partial results)
export async function* streamTranscription(
  audioBlob: Blob,
  apiKey: string,
  options: TranscribeOptions = {}
): AsyncGenerator<{ partial: string } | { final: TranscriptionResult }> {
  // Groq doesn't support streaming transcription directly
  // So we'll just yield the final result
  // In a real implementation, you might use a WebSocket or chunked approach

  yield { partial: 'Transkribiere...' }

  const result = await transcribeAudio(audioBlob, apiKey, options)
  yield { final: result }
}

// Batch transcription for multiple audio files
export async function transcribeBatch(
  audioBlobs: Blob[],
  apiKey: string,
  options: TranscribeOptions = {}
): Promise<TranscriptionResult[]> {
  return Promise.all(
    audioBlobs.map((blob) => transcribeAudio(blob, apiKey, options))
  )
}

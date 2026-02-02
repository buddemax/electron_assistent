import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/ai/groq-client'
import type { ApiResponse } from '@/types/api'
import type { TranscriptionResult } from '@/types/voice'

// Minimum audio file size (in bytes) - roughly 0.5 seconds of audio
const MIN_AUDIO_SIZE = 5000

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null
    const language = formData.get('language') as string | null
    const apiKey = request.headers.get('x-groq-api-key') || process.env.GROQ_API_KEY

    if (!audioFile) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'MISSING_AUDIO',
            message: 'No audio file provided',
          },
        },
        { status: 400 }
      )
    }

    // Check if audio file is too small (likely empty or too short)
    if (audioFile.size < MIN_AUDIO_SIZE) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'AUDIO_TOO_SHORT',
            message: 'Aufnahme zu kurz. Bitte sprich länger.',
          },
        },
        { status: 400 }
      )
    }

    if (!apiKey) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'MISSING_API_KEY',
            message: 'Groq API key is required',
          },
        },
        { status: 401 }
      )
    }

    const startTime = Date.now()

    // Convert File to Blob for the transcription function
    const arrayBuffer = await audioFile.arrayBuffer()

    // Validate array buffer has content
    if (arrayBuffer.byteLength < MIN_AUDIO_SIZE) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'AUDIO_TOO_SHORT',
            message: 'Aufnahme zu kurz. Bitte sprich länger.',
          },
        },
        { status: 400 }
      )
    }

    const audioBlob = new Blob([arrayBuffer], {
      type: audioFile.type || 'audio/webm',
    })

    const transcription = await transcribeAudio(audioBlob, apiKey, {
      language: language || 'de',
    })

    const duration = Date.now() - startTime

    return NextResponse.json<ApiResponse<{ transcription: TranscriptionResult }>>({
      success: true,
      data: { transcription },
      meta: {
        requestId: crypto.randomUUID(),
        duration,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Check for common Groq errors and provide user-friendly messages
    let userMessage = errorMessage
    if (errorMessage.includes('could not process file') || errorMessage.includes('invalid media')) {
      userMessage = 'Audiodatei konnte nicht verarbeitet werden. Bitte versuche es erneut mit einer längeren Aufnahme.'
    } else if (errorMessage.includes('rate limit')) {
      userMessage = 'Zu viele Anfragen. Bitte warte einen Moment.'
    }

    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: {
          code: 'TRANSCRIPTION_FAILED',
          message: userMessage,
          details: error instanceof Error ? { stack: error.stack } : undefined,
        },
      },
      { status: 500 }
    )
  }
}

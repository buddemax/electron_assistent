import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/ai/groq-client'
import type { ApiResponse } from '@/types/api'
import type { TranscriptionResult } from '@/types/voice'

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
    const audioBlob = new Blob([await audioFile.arrayBuffer()], {
      type: audioFile.type,
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

    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: {
          code: 'TRANSCRIPTION_FAILED',
          message: errorMessage,
          details: error instanceof Error ? { stack: error.stack } : undefined,
        },
      },
      { status: 500 }
    )
  }
}

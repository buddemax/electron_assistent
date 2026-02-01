import { NextRequest, NextResponse } from 'next/server'
import { extractEntities, getPrimaryEntityType } from '@/lib/knowledge/entity-extractor'
import type { ApiResponse } from '@/types/api'
import type { Mode } from '@/types/output'
import { z } from 'zod'

const extractRequestSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  mode: z.enum(['private', 'work']),
})

export interface ExtractResponse {
  entities: Array<{
    text: string
    type: string
    confidence: number
  }>
  shouldStore: boolean
  storeReason: string
  suggestedTags: string[]
  primaryType: string | null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const apiKey = request.headers.get('x-gemini-api-key') || process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'MISSING_API_KEY',
            message: 'Gemini API key is required',
          },
        },
        { status: 401 }
      )
    }

    // Validate request body
    const validationResult = extractRequestSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validationResult.error.flatten(),
          },
        },
        { status: 400 }
      )
    }

    const { text, mode } = validationResult.data
    const startTime = Date.now()

    const result = await extractEntities(text, mode as Mode, apiKey)
    const primaryType = getPrimaryEntityType(result.entities)

    const duration = Date.now() - startTime

    return NextResponse.json<ApiResponse<ExtractResponse>>({
      success: true,
      data: {
        entities: result.entities.map(e => ({
          text: e.text,
          type: e.type,
          confidence: e.confidence,
        })),
        shouldStore: result.shouldStore,
        storeReason: result.storeReason,
        suggestedTags: result.suggestedTags,
        primaryType: primaryType || null,
      },
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
          code: 'EXTRACTION_FAILED',
          message: errorMessage,
          details: error instanceof Error ? { stack: error.stack } : undefined,
        },
      },
      { status: 500 }
    )
  }
}

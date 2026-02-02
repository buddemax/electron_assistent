import { NextRequest, NextResponse } from 'next/server'
import { generateOutput, detectOutputType } from '@/lib/ai/gemini-client'
import type { ApiResponse, GenerateRequest, GenerateResponse } from '@/types/api'
import { z } from 'zod'

const profileSchema = z.object({
  jobRole: z.string().max(100).nullable(),
  industry: z.string().max(100).nullable(),
  companySize: z.enum(['solo', 'small', 'medium', 'large', 'enterprise']).nullable(),
  formalityLevel: z.enum(['casual', 'neutral', 'formal', 'very-formal']),
  signatureName: z.string().max(100).nullable(),
  primaryUseCase: z.enum(['emails', 'meetings', 'tasks', 'brainstorm', 'general']).nullable(),
  technicalLevel: z.enum(['non-technical', 'some-technical', 'technical', 'expert']).nullable(),
  preferredOutputLength: z.enum(['concise', 'balanced', 'detailed']),
}).optional()

const questionAnswerSchema = z.object({
  questionId: z.string(),
  answer: z.union([z.string(), z.array(z.string())]),
  answeredAt: z.string().transform((val) => new Date(val)),
})

const generateRequestSchema = z.object({
  transcription: z.string().min(1, 'Transcription is required'),
  mode: z.enum(['private', 'work']),
  outputType: z.enum([
    'email',
    'meeting-note',
    'todo',
    'note',
    'question',
    'brainstorm',
    'summary',
    'calendar',
    'general',
  ]).optional(),
  variant: z.enum(['short', 'standard', 'detailed']).default('standard'),
  /** When true, only generate the specified variant instead of all three */
  singleVariant: z.boolean().optional().default(true),
  context: z.array(z.object({
    id: z.string(),
    snippet: z.string(),
    relevanceScore: z.number(),
  })).optional(),
  customInstructions: z.string().optional(),
  profile: profileSchema,
  conversationContext: z.string().optional(),
  dailyQuestionsAnswers: z.array(questionAnswerSchema).optional(),
})

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
    const validationResult = generateRequestSchema.safeParse(body)
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

    const data = validationResult.data
    const startTime = Date.now()

    const result = await generateOutput(
      {
        transcription: data.transcription,
        mode: data.mode,
        outputType: data.outputType,
        variant: data.variant,
        singleVariant: data.singleVariant,
        context: data.context,
        customInstructions: data.customInstructions,
        profile: data.profile,
        conversationContext: data.conversationContext,
        dailyQuestionsAnswers: data.dailyQuestionsAnswers,
      },
      apiKey
    )

    const duration = Date.now() - startTime

    return NextResponse.json<ApiResponse<GenerateResponse>>({
      success: true,
      data: result,
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
          code: 'GENERATION_FAILED',
          message: errorMessage,
        },
      },
      { status: 500 }
    )
  }
}

// Endpoint for output type detection only
export async function PUT(request: NextRequest) {
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

    const { text } = body
    if (!text || typeof text !== 'string') {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Text is required',
          },
        },
        { status: 400 }
      )
    }

    const startTime = Date.now()
    const outputType = await detectOutputType(text, apiKey)
    const duration = Date.now() - startTime

    return NextResponse.json<ApiResponse<{ type: string; confidence: number }>>({
      success: true,
      data: {
        type: outputType,
        confidence: 0.9, // Placeholder - could be extracted from model response
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
          code: 'DETECTION_FAILED',
          message: errorMessage,
        },
      },
      { status: 500 }
    )
  }
}

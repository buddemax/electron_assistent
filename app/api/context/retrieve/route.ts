import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { ApiResponse } from '@/types/api'
import type { KnowledgeReference, EntityType } from '@/types/knowledge'
import type { Intent } from '@/lib/context/intent-detector'
import {
  detectIntent,
  requiresContextRetrieval,
} from '@/lib/context/intent-detector'
import { retrieveContext, buildContextString, getRelevantEntityTypes } from '@/lib/context/context-retrieval'

const retrieveRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  mode: z.enum(['work', 'private']),
  limit: z.number().int().min(1).max(20).optional().default(5),
  includeExternal: z.boolean().optional().default(false),
  entityTypes: z.array(z.enum([
    'person', 'project', 'technology', 'company',
    'deadline', 'decision', 'fact', 'preference', 'unknown',
  ])).optional(),
})

export interface ContextRetrieveResponse {
  readonly context: readonly KnowledgeReference[]
  readonly intent: Intent
  readonly intentConfidence: number
  readonly sources: readonly string[]
  readonly contextString: string
  readonly extractedEntity?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request
    const validationResult = retrieveRequestSchema.safeParse(body)
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

    const { query, mode, limit, includeExternal, entityTypes } = validationResult.data
    const startTime = Date.now()

    // Detect intent
    const intentResult = detectIntent(query)

    // Get knowledge entries from storage
    // Note: In production, this would fetch from Electron storage or database
    // For API route, we expect entries to be passed or fetched differently
    const knowledgeEntries = await getKnowledgeEntries()

    // Determine entity types to search
    const searchEntityTypes = entityTypes || getRelevantEntityTypes(intentResult.intent)

    // Retrieve context from knowledge base
    const knowledgeContext = requiresContextRetrieval(intentResult.intent)
      ? retrieveContext(knowledgeEntries, {
          query,
          mode,
          limit,
          entityTypes: searchEntityTypes,
        })
      : { context: [], matchedKeywords: [], totalMatches: 0 }

    // Collect sources
    const sources: string[] = ['knowledge']

    // Build response
    const contextString = buildContextString(knowledgeContext.context)

    const duration = Date.now() - startTime

    return NextResponse.json<ApiResponse<ContextRetrieveResponse>>({
      success: true,
      data: {
        context: knowledgeContext.context,
        intent: intentResult.intent,
        intentConfidence: intentResult.confidence,
        sources,
        contextString,
        extractedEntity: intentResult.extractedEntity,
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
          code: 'CONTEXT_RETRIEVAL_FAILED',
          message: errorMessage,
          details: error instanceof Error ? { stack: error.stack } : undefined,
        },
      },
      { status: 500 }
    )
  }
}

/**
 * Placeholder for getting knowledge entries
 * In production, this would fetch from Electron storage or a database
 */
async function getKnowledgeEntries() {
  // This is a placeholder - in the actual app, entries are stored
  // in Electron's local storage and accessed via IPC
  // For now, return empty array (context will be populated from client-side store)
  return []
}

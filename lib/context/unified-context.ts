import type { Mode } from '@/types/output'
import type { KnowledgeEntry, KnowledgeReference } from '@/types/knowledge'
import { retrieveContext } from './context-retrieval'
import type { Intent } from './intent-detector'

export interface UnifiedContext {
  readonly references: readonly KnowledgeReference[]
  readonly totalMatches: number
}

export interface AssembleContextOptions {
  readonly query: string
  readonly mode: Mode
  readonly intent?: Intent
  readonly limit?: number
}

/**
 * Assemble context from knowledge base
 */
export async function assembleContext(
  options: AssembleContextOptions,
  knowledgeEntries: readonly KnowledgeEntry[]
): Promise<UnifiedContext> {
  const { query, mode, limit = 5 } = options

  // Knowledge Base only
  const knowledgeResult = retrieveContext(knowledgeEntries, {
    query,
    mode,
    limit,
  })

  return {
    references: knowledgeResult.context,
    totalMatches: knowledgeResult.context.length,
  }
}


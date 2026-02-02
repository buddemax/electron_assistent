import type { Mode } from '@/types/output'
import type { KnowledgeEntry, KnowledgeReference } from '@/types/knowledge'
import type { DocumentEntry } from '@/types/document'
import type { Conversation } from '@/types/conversation'
import { retrieveCombinedContext } from './context-retrieval'
import {
  buildConversationInstruction,
  extractConversationReferences,
} from './conversation-context'
import type { Intent } from './intent-detector'

export interface UnifiedContext {
  readonly references: readonly KnowledgeReference[]
  readonly totalMatches: number
  readonly knowledgeMatches: number
  readonly documentMatches: number
  readonly matchedDocuments: readonly string[]
  readonly conversationContext?: string
  readonly conversationMessageCount?: number
}

export interface AssembleContextOptions {
  readonly query: string
  readonly mode: Mode
  readonly intent?: Intent
  readonly limit?: number
  readonly knowledgeLimit?: number
  readonly documentLimit?: number
  readonly conversation?: Conversation | null
  readonly conversationMessageLimit?: number
}

/**
 * Assemble context from knowledge base, documents, AND conversation history
 */
export async function assembleContext(
  options: AssembleContextOptions,
  knowledgeEntries: readonly KnowledgeEntry[],
  documents: readonly DocumentEntry[] = []
): Promise<UnifiedContext> {
  const {
    query,
    mode,
    limit = 8,
    knowledgeLimit = 5,
    documentLimit = 3,
    conversation = null,
    conversationMessageLimit = 6,
  } = options

  // Combined retrieval from knowledge AND documents
  const combinedResult = retrieveCombinedContext(knowledgeEntries, {
    query,
    mode,
    limit,
    knowledgeLimit,
    documentLimit,
    documents,
  })

  // Build conversation context if available
  let conversationContext: string | undefined
  let conversationMessageCount: number | undefined

  if (conversation && conversation.messages.length > 0) {
    // Use the new instruction builder that understands follow-up questions
    conversationContext = buildConversationInstruction(conversation, query)
    conversationMessageCount = conversation.messages.length

    // Extract references from conversation history and merge them
    // This ensures documents/knowledge from previous questions are available
    const convReferences = extractConversationReferences(conversation, 5)
    const allReferences = [...combinedResult.context]

    for (const ref of convReferences) {
      if (!allReferences.some((r) => r.id === ref.id)) {
        allReferences.push(ref)
      }
    }

    return {
      references: allReferences,
      totalMatches:
        combinedResult.knowledgeMatches + combinedResult.documentMatches,
      knowledgeMatches: combinedResult.knowledgeMatches,
      documentMatches: combinedResult.documentMatches,
      matchedDocuments: combinedResult.matchedDocuments,
      conversationContext,
      conversationMessageCount,
    }
  }

  return {
    references: combinedResult.context,
    totalMatches:
      combinedResult.knowledgeMatches + combinedResult.documentMatches,
    knowledgeMatches: combinedResult.knowledgeMatches,
    documentMatches: combinedResult.documentMatches,
    matchedDocuments: combinedResult.matchedDocuments,
  }
}

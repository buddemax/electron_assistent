import type { Mode } from '@/types/output'
import type { KnowledgeEntry, KnowledgeReference } from '@/types/knowledge'
import { retrieveContext } from './context-retrieval'

export interface LiveSuggestion {
  readonly id: string
  readonly type: 'entity' | 'context' | 'action'
  readonly title: string
  readonly snippet: string
  readonly relevanceScore: number
  readonly entityType?: string
}

/**
 * Extract potential entities from partial transcription
 */
function extractPotentialEntities(text: string): readonly string[] {
  const entities: string[] = []

  // Look for capitalized words (potential names, projects)
  const capitalizedWords = text.match(/\b[A-ZÄÖÜ][a-zäöüß]+(\s+[A-ZÄÖÜ][a-zäöüß]+)*/g)
  if (capitalizedWords) {
    entities.push(...capitalizedWords)
  }

  // Look for quoted text
  const quotedText = text.match(/"([^"]+)"/g)
  if (quotedText) {
    entities.push(...quotedText.map(q => q.replace(/"/g, '')))
  }

  // Look for words after indicators
  const indicators = [
    /über\s+(\w+(?:\s+\w+)?)/gi,
    /mit\s+(\w+(?:\s+\w+)?)/gi,
    /für\s+(\w+(?:\s+\w+)?)/gi,
    /projekt\s+(\w+(?:\s+\w+)?)/gi,
    /von\s+(\w+(?:\s+\w+)?)/gi,
  ]

  for (const indicator of indicators) {
    const matches = [...text.matchAll(indicator)]
    for (const match of matches) {
      if (match[1]) entities.push(match[1])
    }
  }

  // Deduplicate
  return [...new Set(entities)]
}

/**
 * Debounce helper for live suggestions
 */
export function createDebouncedFetcher(
  delay: number = 300
): {
  fetch: (
    text: string,
    mode: Mode,
    entries: readonly KnowledgeEntry[]
  ) => Promise<readonly LiveSuggestion[]>
  cancel: () => void
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastText = ''

  return {
    fetch: (text: string, mode: Mode, entries: readonly KnowledgeEntry[]) => {
      return new Promise((resolve) => {
        // Cancel previous timeout
        if (timeoutId) {
          clearTimeout(timeoutId)
        }

        // Skip if text hasn't changed significantly
        if (text.length < 3 || text === lastText) {
          resolve([])
          return
        }

        lastText = text

        timeoutId = setTimeout(async () => {
          const suggestions = await fetchLiveSuggestions(text, mode, entries)
          resolve(suggestions)
        }, delay)
      })
    },
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    },
  }
}

/**
 * Fetch live suggestions based on partial transcription
 */
export async function fetchLiveSuggestions(
  partialText: string,
  mode: Mode,
  entries: readonly KnowledgeEntry[]
): Promise<readonly LiveSuggestion[]> {
  const suggestions: LiveSuggestion[] = []

  // Extract potential entities from the text
  const potentialEntities = extractPotentialEntities(partialText)

  // Search knowledge base for each entity
  for (const entity of potentialEntities.slice(0, 3)) {
    const result = retrieveContext(entries, {
      query: entity,
      mode,
      limit: 2,
      minRelevance: 0.4,
    })

    for (const ref of result.context) {
      suggestions.push({
        id: ref.id,
        type: 'context',
        title: entity,
        snippet: ref.snippet,
        relevanceScore: ref.relevanceScore,
      })
    }
  }

  // Also do a general search with the last few words
  const lastWords = partialText.split(/\s+/).slice(-5).join(' ')
  if (lastWords.length > 5) {
    const generalResult = retrieveContext(entries, {
      query: lastWords,
      mode,
      limit: 3,
      minRelevance: 0.3,
    })

    for (const ref of generalResult.context) {
      // Avoid duplicates
      if (!suggestions.find(s => s.id === ref.id)) {
        suggestions.push({
          id: ref.id,
          type: 'context',
          title: 'Relevanter Kontext',
          snippet: ref.snippet,
          relevanceScore: ref.relevanceScore * 0.8, // Slightly lower score for general matches
        })
      }
    }
  }

  // Sort by relevance and limit
  return suggestions
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5)
}

/**
 * Convert KnowledgeReference to LiveSuggestion
 */
export function referenceToSuggestion(
  ref: KnowledgeReference,
  title: string
): LiveSuggestion {
  return {
    id: ref.id,
    type: 'context',
    title,
    snippet: ref.snippet,
    relevanceScore: ref.relevanceScore,
  }
}

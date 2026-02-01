import type { Mode } from '@/types/output'
import type { KnowledgeEntry, KnowledgeReference, EntityType } from '@/types/knowledge'
import type { Intent, IntentDetectionResult } from './intent-detector'

export interface ContextRetrievalOptions {
  readonly query: string
  readonly mode: Mode
  readonly limit?: number
  readonly entityTypes?: readonly EntityType[]
  readonly minRelevance?: number
}

export interface ContextRetrievalResult {
  readonly context: readonly KnowledgeReference[]
  readonly matchedKeywords: readonly string[]
  readonly totalMatches: number
}

interface ScoredEntry {
  readonly entry: KnowledgeEntry
  readonly score: number
  readonly matchedTerms: readonly string[]
}

const DEFAULT_LIMIT = 5
const DEFAULT_MIN_RELEVANCE = 0.3

/**
 * Extract search keywords from query
 */
function extractKeywords(query: string): readonly string[] {
  const stopWords = new Set([
    'der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'aber', 'wenn',
    'weil', 'für', 'mit', 'von', 'zu', 'an', 'in', 'auf', 'ist', 'sind',
    'hat', 'haben', 'was', 'wer', 'wie', 'wo', 'wann', 'warum', 'ich',
    'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'mir', 'über', 'nach',
  ])

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .map(word => word.replace(/[^\wäöüß]/g, ''))
    .filter(word => word.length > 0)
}

/**
 * Calculate keyword match score
 */
function calculateKeywordScore(
  content: string,
  keywords: readonly string[]
): { score: number; matchedTerms: readonly string[] } {
  const normalizedContent = content.toLowerCase()
  const matchedTerms: string[] = []
  let matchCount = 0

  for (const keyword of keywords) {
    if (normalizedContent.includes(keyword)) {
      matchCount++
      matchedTerms.push(keyword)
    }
  }

  const score = keywords.length > 0 ? matchCount / keywords.length : 0
  return { score, matchedTerms }
}

/**
 * Calculate recency score (more recent = higher score)
 */
function calculateRecencyScore(createdAt: Date): number {
  const now = Date.now()
  const ageMs = now - createdAt.getTime()
  const ageHours = ageMs / (1000 * 60 * 60)

  // Full score for last 24 hours, decreasing over 30 days
  if (ageHours <= 24) return 1
  if (ageHours <= 168) return 0.8 // Last week
  if (ageHours <= 720) return 0.5 // Last month
  return 0.2
}

/**
 * Calculate access frequency score
 */
function calculateAccessScore(accessCount: number): number {
  // Normalize access count (assume max ~100 accesses)
  return Math.min(1, accessCount / 100)
}

/**
 * Calculate combined relevance score
 */
function calculateRelevanceScore(
  keywordScore: number,
  recencyScore: number,
  accessScore: number
): number {
  // Weighted combination: semantic 50%, recency 30%, access 20%
  return keywordScore * 0.5 + recencyScore * 0.3 + accessScore * 0.2
}

/**
 * Retrieve relevant context from knowledge entries
 */
export function retrieveContext(
  entries: readonly KnowledgeEntry[],
  options: ContextRetrievalOptions
): ContextRetrievalResult {
  const {
    query,
    mode,
    limit = DEFAULT_LIMIT,
    entityTypes,
    minRelevance = DEFAULT_MIN_RELEVANCE,
  } = options

  const keywords = extractKeywords(query)

  // Filter and score entries
  const scoredEntries: ScoredEntry[] = entries
    .filter(entry => {
      // Mode filter
      if (entry.mode !== mode) return false

      // Entity type filter
      if (entityTypes && entityTypes.length > 0) {
        if (!entry.metadata.entityType) return false
        if (!entityTypes.includes(entry.metadata.entityType)) return false
      }

      return true
    })
    .map(entry => {
      const { score: keywordScore, matchedTerms } = calculateKeywordScore(
        entry.content,
        keywords
      )
      const recencyScore = calculateRecencyScore(entry.createdAt)
      const accessScore = calculateAccessScore(entry.metadata.accessCount)
      const score = calculateRelevanceScore(keywordScore, recencyScore, accessScore)

      return { entry, score, matchedTerms }
    })
    .filter(scored => scored.score >= minRelevance)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  // Convert to KnowledgeReference
  const context: KnowledgeReference[] = scoredEntries.map(({ entry, score }) => ({
    id: entry.id,
    snippet: createSnippet(entry.content, 150),
    relevanceScore: score,
  }))

  // Collect all matched keywords
  const allMatchedKeywords = [
    ...new Set(scoredEntries.flatMap(e => e.matchedTerms)),
  ]

  return {
    context,
    matchedKeywords: allMatchedKeywords,
    totalMatches: scoredEntries.length,
  }
}

/**
 * Create a snippet from content
 */
function createSnippet(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength - 3) + '...'
}

/**
 * Build context string for AI prompt
 */
export function buildContextString(
  references: readonly KnowledgeReference[]
): string {
  if (references.length === 0) return ''

  const contextLines = references.map((ref, index) =>
    `[${index + 1}] ${ref.snippet}`
  )

  return `Relevanter Kontext aus der Knowledge Base:\n${contextLines.join('\n')}`
}

/**
 * Get entity types relevant to an intent
 */
export function getRelevantEntityTypes(intent: Intent): readonly EntityType[] | undefined {
  const mapping: Partial<Record<Intent, readonly EntityType[]>> = {
    birthday_query: ['person'],
    person_query: ['person'],
    project_query: ['project', 'decision', 'deadline'],
  }
  return mapping[intent]
}

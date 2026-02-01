import type { Mode } from './output'

export interface KnowledgeEntry {
  readonly id: string
  readonly mode: Mode
  readonly content: string
  readonly embedding: Float32Array
  readonly metadata: KnowledgeMetadata
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface KnowledgeMetadata {
  readonly source: 'voice' | 'import' | 'generated'
  readonly tags: readonly string[]
  readonly entityType?: EntityType
  readonly accessCount: number
  readonly lastAccessedAt: Date
  readonly relevanceDecay: number
}

export type EntityType =
  | 'person'
  | 'project'
  | 'technology'
  | 'company'
  | 'deadline'
  | 'decision'
  | 'fact'
  | 'preference'
  | 'unknown'

export interface KnowledgeSearchResult {
  readonly entry: KnowledgeEntry
  readonly score: number
  readonly highlights: readonly string[]
}

export interface KnowledgeReference {
  readonly id: string
  readonly snippet: string
  readonly relevanceScore: number
  readonly source?: 'knowledge' | 'contacts' | 'calendar' | 'email' | 'files'
}

export interface SmartSuggestion {
  readonly id: string
  readonly type: 'context' | 'action' | 'reminder'
  readonly content: string
  readonly relevance: number
  readonly source: KnowledgeReference
  readonly trigger: string
  readonly expiresAt: Date
}

export interface KnowledgeStats {
  readonly totalEntries: number
  readonly entriesByMode: Record<Mode, number>
  readonly entriesByType: Record<EntityType, number>
  readonly averageRelevance: number
  readonly lastUpdated: Date
}

export interface ExtractedEntity {
  readonly text: string
  readonly type: EntityType
  readonly confidence: number
  readonly startIndex: number
  readonly endIndex: number
}

export interface KnowledgeFilter {
  readonly mode?: Mode
  readonly entityTypes?: readonly EntityType[]
  readonly tags?: readonly string[]
  readonly minRelevance?: number
  readonly createdAfter?: Date
  readonly createdBefore?: Date
}

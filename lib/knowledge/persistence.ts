import type { KnowledgeEntry, KnowledgeMetadata, EntityType } from '@/types/knowledge'
import type { Mode } from '@/types/output'

/**
 * Serializable version of KnowledgeEntry for storage
 * Float32Array is converted to number[] for JSON compatibility
 */
export interface SerializedKnowledgeEntry {
  readonly id: string
  readonly mode: Mode
  readonly content: string
  readonly embedding: number[] // Serialized Float32Array
  readonly metadata: SerializedKnowledgeMetadata
  readonly createdAt: string // ISO string
  readonly updatedAt: string // ISO string
}

export interface SerializedKnowledgeMetadata {
  readonly source: 'voice' | 'import' | 'generated'
  readonly tags: readonly string[]
  readonly entityType?: EntityType
  readonly accessCount: number
  readonly lastAccessedAt: string // ISO string
  readonly relevanceDecay: number
}

/**
 * Convert KnowledgeEntry to serializable format
 */
export function serializeEntry(entry: KnowledgeEntry): SerializedKnowledgeEntry {
  return {
    id: entry.id,
    mode: entry.mode,
    content: entry.content,
    embedding: Array.from(entry.embedding),
    metadata: {
      source: entry.metadata.source,
      tags: [...entry.metadata.tags],
      entityType: entry.metadata.entityType,
      accessCount: entry.metadata.accessCount,
      lastAccessedAt: entry.metadata.lastAccessedAt.toISOString(),
      relevanceDecay: entry.metadata.relevanceDecay,
    },
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }
}

/**
 * Convert serialized entry back to KnowledgeEntry
 */
export function deserializeEntry(serialized: SerializedKnowledgeEntry): KnowledgeEntry {
  return {
    id: serialized.id,
    mode: serialized.mode,
    content: serialized.content,
    embedding: new Float32Array(serialized.embedding),
    metadata: {
      source: serialized.metadata.source,
      tags: serialized.metadata.tags,
      entityType: serialized.metadata.entityType,
      accessCount: serialized.metadata.accessCount,
      lastAccessedAt: new Date(serialized.metadata.lastAccessedAt),
      relevanceDecay: serialized.metadata.relevanceDecay,
    },
    createdAt: new Date(serialized.createdAt),
    updatedAt: new Date(serialized.updatedAt),
  }
}

/**
 * Serialize multiple entries
 */
export function serializeEntries(entries: readonly KnowledgeEntry[]): SerializedKnowledgeEntry[] {
  return entries.map(serializeEntry)
}

/**
 * Deserialize multiple entries
 */
export function deserializeEntries(serialized: SerializedKnowledgeEntry[]): KnowledgeEntry[] {
  return serialized.map(deserializeEntry)
}

/**
 * Create a new KnowledgeEntry with defaults
 */
export function createKnowledgeEntry(params: {
  content: string
  mode: Mode
  entityType?: EntityType
  tags?: string[]
  source?: 'voice' | 'import' | 'generated'
}): KnowledgeEntry {
  const now = new Date()
  return {
    id: crypto.randomUUID(),
    mode: params.mode,
    content: params.content,
    embedding: new Float32Array(0), // Will be filled by embedding service later
    metadata: {
      source: params.source || 'voice',
      tags: params.tags || [],
      entityType: params.entityType,
      accessCount: 0,
      lastAccessedAt: now,
      relevanceDecay: 1.0,
    },
    createdAt: now,
    updatedAt: now,
  }
}

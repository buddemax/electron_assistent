/**
 * Document types for file upload and context extraction
 */

import type { Mode } from './output'
import type { EntityType } from './knowledge'

// Document file types
export type DocumentFileType = 'pdf' | 'docx' | 'pptx'

// Processing status
export type DocumentStatus =
  | 'pending'
  | 'extracting'
  | 'analyzing'
  | 'complete'
  | 'error'

// Summary with multiple detail levels
export interface DocumentSummary {
  readonly brief: string
  readonly standard: string
  readonly comprehensive: string
}

// Topic with relevance scoring
export interface DocumentTopic {
  readonly name: string
  readonly relevance: number
  readonly subtopics: readonly string[]
  readonly relatedKeywords: readonly string[]
}

// Entity extracted from document
export interface DocumentEntity {
  readonly text: string
  readonly type: EntityType
  readonly mentions: number
  readonly context: string
  readonly confidence: number
}

// Key fact from document
export type FactCategory = 'statistic' | 'claim' | 'definition' | 'requirement' | 'other'

export interface KeyFact {
  readonly fact: string
  readonly category: FactCategory
  readonly source: string
  readonly confidence: number
}

// Relationship between entities
export interface EntityRelationship {
  readonly entity1: string
  readonly entity2: string
  readonly relationshipType: string
  readonly description: string
}

// Action item extracted from document
export type ActionPriority = 'high' | 'medium' | 'low'

export interface ActionItem {
  readonly task: string
  readonly assignee: string | null
  readonly deadline: string | null
  readonly priority: ActionPriority
  readonly context: string
}

// Decision extracted from document
export interface DocumentDecision {
  readonly decision: string
  readonly rationale: string | null
  readonly stakeholders: readonly string[]
  readonly date: string | null
}

// Deadline extracted from document
export interface DocumentDeadline {
  readonly description: string
  readonly date: string
  readonly associatedTask: string | null
}

// Rich extracted context from document
export interface DocumentContext {
  readonly id: string
  readonly documentId: string

  // Core Summary
  readonly summary: DocumentSummary

  // Extracted Information
  readonly topics: readonly DocumentTopic[]
  readonly entities: readonly DocumentEntity[]
  readonly keyFacts: readonly KeyFact[]
  readonly relationships: readonly EntityRelationship[]

  // Actionable Items
  readonly actionItems: readonly ActionItem[]
  readonly decisions: readonly DocumentDecision[]
  readonly deadlines: readonly DocumentDeadline[]

  // Metadata
  readonly confidence: number
  readonly processingTimestamp: Date
  readonly geminiModelUsed: string
}

// Main document entry
export interface DocumentEntry {
  readonly id: string
  readonly filename: string
  readonly originalPath: string
  readonly fileType: DocumentFileType
  readonly fileSize: number
  readonly pageCount: number | null
  readonly slideCount: number | null

  // Processing state
  readonly status: DocumentStatus
  readonly processingError: string | null
  readonly processingProgress: number

  // Extracted content
  readonly rawText: string
  readonly context: DocumentContext | null

  // Integration with knowledge base
  readonly knowledgeEntryIds: readonly string[]
  readonly mode: Mode

  // Timestamps
  readonly uploadedAt: Date
  readonly processedAt: Date | null
  readonly lastAccessedAt: Date
}

// Serialized version for persistence
export interface SerializedDocumentContext {
  readonly id: string
  readonly documentId: string
  readonly summary: DocumentSummary
  readonly topics: readonly DocumentTopic[]
  readonly entities: readonly DocumentEntity[]
  readonly keyFacts: readonly KeyFact[]
  readonly relationships: readonly EntityRelationship[]
  readonly actionItems: readonly ActionItem[]
  readonly decisions: readonly DocumentDecision[]
  readonly deadlines: readonly DocumentDeadline[]
  readonly confidence: number
  readonly processingTimestamp: string
  readonly geminiModelUsed: string
}

export interface SerializedDocumentEntry {
  readonly id: string
  readonly filename: string
  readonly originalPath: string
  readonly fileType: DocumentFileType
  readonly fileSize: number
  readonly pageCount: number | null
  readonly slideCount: number | null
  readonly status: DocumentStatus
  readonly processingError: string | null
  readonly processingProgress: number
  readonly rawText: string
  readonly context: SerializedDocumentContext | null
  readonly knowledgeEntryIds: readonly string[]
  readonly mode: Mode
  readonly uploadedAt: string
  readonly processedAt: string | null
  readonly lastAccessedAt: string
}

// Utility functions for serialization
export function serializeDocumentEntry(entry: DocumentEntry): SerializedDocumentEntry {
  return {
    ...entry,
    context: entry.context
      ? {
          ...entry.context,
          processingTimestamp: entry.context.processingTimestamp.toISOString(),
        }
      : null,
    uploadedAt: entry.uploadedAt.toISOString(),
    processedAt: entry.processedAt?.toISOString() ?? null,
    lastAccessedAt: entry.lastAccessedAt.toISOString(),
  }
}

export function deserializeDocumentEntry(serialized: SerializedDocumentEntry): DocumentEntry {
  return {
    ...serialized,
    context: serialized.context
      ? {
          ...serialized.context,
          processingTimestamp: new Date(serialized.context.processingTimestamp),
        }
      : null,
    uploadedAt: new Date(serialized.uploadedAt),
    processedAt: serialized.processedAt ? new Date(serialized.processedAt) : null,
    lastAccessedAt: new Date(serialized.lastAccessedAt),
  }
}

// Default empty context
export function createEmptyContext(documentId: string): DocumentContext {
  return {
    id: crypto.randomUUID(),
    documentId,
    summary: {
      brief: '',
      standard: '',
      comprehensive: '',
    },
    topics: [],
    entities: [],
    keyFacts: [],
    relationships: [],
    actionItems: [],
    decisions: [],
    deadlines: [],
    confidence: 0,
    processingTimestamp: new Date(),
    geminiModelUsed: '',
  }
}

// File type detection
export function getDocumentFileType(filename: string): DocumentFileType | null {
  const ext = filename.toLowerCase().split('.').pop()
  switch (ext) {
    case 'pdf':
      return 'pdf'
    case 'docx':
      return 'docx'
    case 'pptx':
      return 'pptx'
    default:
      return null
  }
}

// File type labels
export const DOCUMENT_TYPE_LABELS: Record<DocumentFileType, string> = {
  pdf: 'PDF',
  docx: 'Word',
  pptx: 'PowerPoint',
}

// Max file size (50MB)
export const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024

// Accepted MIME types
export const ACCEPTED_DOCUMENT_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
}

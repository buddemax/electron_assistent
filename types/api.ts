import type { Mode, OutputType, OutputVariant, GeneratedOutput } from './output'
import type { KnowledgeReference, KnowledgeEntry, SmartSuggestion, KnowledgeSearchResult } from './knowledge'
import type { TranscriptionResult } from './voice'
import type { GraphNode, GraphEdge } from './graph'

// Re-export KnowledgeSearchResult from knowledge for convenience (used in this module)
export type { KnowledgeSearchResult } from './knowledge'

export interface ApiResponse<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: ApiError
  readonly meta?: ResponseMeta
}

export interface ApiError {
  readonly code: string
  readonly message: string
  readonly details?: Record<string, unknown>
}

export interface ResponseMeta {
  readonly requestId: string
  readonly duration: number
  readonly timestamp: string
}

// Transcription API
export interface TranscribeRequest {
  readonly audio: Blob
  readonly language?: string
}

export interface TranscribeResponse {
  readonly transcription: TranscriptionResult
}

// Generation API
export interface GenerateRequest {
  readonly transcription: string
  readonly mode: Mode
  readonly outputType?: OutputType
  readonly variant: OutputVariant
  readonly context?: readonly KnowledgeReference[]
  readonly customInstructions?: string
}

export interface GenerateResponse {
  readonly outputs: {
    readonly short: GeneratedOutput
    readonly standard: GeneratedOutput
    readonly detailed: GeneratedOutput
  }
  readonly detectedType: OutputType
  readonly usedContext: readonly KnowledgeReference[]
}

// Knowledge API
export interface KnowledgeSearchRequest {
  readonly query: string
  readonly mode: Mode
  readonly limit?: number
  readonly minRelevance?: number
}

export interface KnowledgeSearchResponse {
  readonly results: readonly KnowledgeSearchResult[]
  readonly totalCount: number
}

export interface KnowledgeCreateRequest {
  readonly content: string
  readonly mode: Mode
  readonly tags?: readonly string[]
  readonly source?: 'voice' | 'import' | 'generated'
}

export interface KnowledgeCreateResponse {
  readonly entry: KnowledgeEntry
}

export interface KnowledgeUpdateRequest {
  readonly id: string
  readonly content?: string
  readonly tags?: readonly string[]
}

export interface KnowledgeDeleteRequest {
  readonly id: string
}

// Graph API
export interface GraphDataRequest {
  readonly mode: Mode
  readonly limit?: number
  readonly centerNodeId?: string
}

export interface GraphDataResponse {
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
}

// Suggestions API
export interface SuggestionsRequest {
  readonly partialText: string
  readonly mode: Mode
  readonly limit?: number
}

export interface SuggestionsResponse {
  readonly suggestions: readonly SmartSuggestion[]
}

// Output Detection API
export interface DetectOutputTypeRequest {
  readonly text: string
}

export interface DetectOutputTypeResponse {
  readonly type: OutputType
  readonly confidence: number
  readonly indicators: readonly string[]
}

import type { KnowledgeReference } from './knowledge'

export type OutputType =
  | 'email'
  | 'meeting-note'
  | 'todo'
  | 'question'
  | 'brainstorm'
  | 'summary'
  | 'code'
  | 'general'

export type OutputVariant = 'short' | 'standard' | 'detailed'

export type Mode = 'private' | 'work'

// Re-export KnowledgeReference for consumers of this module
export type { KnowledgeReference } from './knowledge'

export interface GeneratedOutput {
  readonly id: string
  readonly type: OutputType
  readonly variant: OutputVariant
  readonly mode: Mode
  readonly content: OutputContent
  readonly originalTranscription: string
  readonly metadata: OutputMetadata
  readonly createdAt: Date
}

export interface OutputContent {
  readonly title?: string
  readonly body: string
  readonly structured?: Record<string, unknown>
}

export interface OutputMetadata {
  readonly wordCount: number
  readonly estimatedReadTime: number
  readonly suggestedActions: readonly SuggestedAction[]
  readonly relatedKnowledge: readonly KnowledgeReference[]
}

export interface SuggestedAction {
  readonly type: 'copy' | 'export' | 'save' | 'share' | 'edit'
  readonly label: string
  readonly shortcut?: string
}

// Email-specific output
export interface EmailOutput extends GeneratedOutput {
  readonly type: 'email'
  readonly content: EmailContent
}

export interface EmailContent extends OutputContent {
  readonly structured: {
    readonly to: string
    readonly subject: string
    readonly greeting: string
    readonly body: string
    readonly closing: string
  }
}

// Todo-specific output
export interface TodoOutput extends GeneratedOutput {
  readonly type: 'todo'
  readonly content: TodoContent
}

export interface TodoContent extends OutputContent {
  readonly structured: {
    readonly items: readonly TodoItem[]
    readonly priority: 'low' | 'medium' | 'high'
    readonly dueDate?: string
  }
}

export interface TodoItem {
  readonly id: string
  readonly text: string
  readonly completed: boolean
}

// Meeting note output
export interface MeetingNoteOutput extends GeneratedOutput {
  readonly type: 'meeting-note'
  readonly content: MeetingNoteContent
}

export interface MeetingNoteContent extends OutputContent {
  readonly structured: {
    readonly date: string
    readonly attendees: readonly string[]
    readonly topics: readonly string[]
    readonly decisions: readonly string[]
    readonly actionItems: readonly TodoItem[]
    readonly nextSteps: readonly string[]
  }
}

// Code output
export interface CodeOutput extends GeneratedOutput {
  readonly type: 'code'
  readonly content: CodeContent
}

export interface CodeContent extends OutputContent {
  readonly structured: {
    readonly language: string
    readonly code: string
    readonly explanation: string
  }
}

// Brainstorm output
export interface BrainstormOutput extends GeneratedOutput {
  readonly type: 'brainstorm'
  readonly content: BrainstormContent
}

export interface BrainstormContent extends OutputContent {
  readonly structured: {
    readonly topic: string
    readonly ideas: readonly BrainstormIdea[]
  }
}

export interface BrainstormIdea {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly category?: string
}

// Summary output
export interface SummaryOutput extends GeneratedOutput {
  readonly type: 'summary'
  readonly content: SummaryContent
}

export interface SummaryContent extends OutputContent {
  readonly structured: {
    readonly keyPoints: readonly string[]
    readonly conclusion?: string
  }
}

// Question output
export interface QuestionOutput extends GeneratedOutput {
  readonly type: 'question'
  readonly content: QuestionContent
}

export interface QuestionContent extends OutputContent {
  readonly structured: {
    readonly question: string
    readonly answer: string
    readonly sources?: readonly KnowledgeReference[]
    readonly confidence: number
  }
}

// All output variants
export type AnyOutput =
  | EmailOutput
  | TodoOutput
  | MeetingNoteOutput
  | CodeOutput
  | BrainstormOutput
  | SummaryOutput
  | QuestionOutput
  | GeneratedOutput

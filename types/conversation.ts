import type { Mode } from './output'
import type { KnowledgeReference } from './knowledge'

// Message role
export type MessageRole = 'user' | 'assistant'

// Single message in a conversation
export interface ConversationMessage {
  readonly id: string
  readonly role: MessageRole
  readonly content: string
  readonly timestamp: Date
  readonly metadata?: MessageMetadata
}

export interface MessageMetadata {
  readonly transcriptionId?: string
  readonly outputId?: string
  readonly usedContext?: readonly KnowledgeReference[]
  readonly outputType?: string
}

// Conversation
export interface Conversation {
  readonly id: string
  readonly title: string
  readonly mode: Mode
  readonly messages: readonly ConversationMessage[]
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly isActive: boolean
}

// Serialized versions for persistence
export interface SerializedConversationMessage {
  readonly id: string
  readonly role: MessageRole
  readonly content: string
  readonly timestamp: string
  readonly metadata?: MessageMetadata
}

export interface SerializedConversation {
  readonly id: string
  readonly title: string
  readonly mode: Mode
  readonly messages: readonly SerializedConversationMessage[]
  readonly createdAt: string
  readonly updatedAt: string
  readonly isActive: boolean
}

// Serialization helpers
export function serializeMessage(msg: ConversationMessage): SerializedConversationMessage {
  return {
    ...msg,
    timestamp: msg.timestamp.toISOString(),
  }
}

export function deserializeMessage(msg: SerializedConversationMessage): ConversationMessage {
  return {
    ...msg,
    timestamp: new Date(msg.timestamp),
  }
}

export function serializeConversation(conv: Conversation): SerializedConversation {
  return {
    ...conv,
    messages: conv.messages.map(serializeMessage),
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
  }
}

export function deserializeConversation(conv: SerializedConversation): Conversation {
  return {
    ...conv,
    messages: conv.messages.map(deserializeMessage),
    createdAt: new Date(conv.createdAt),
    updatedAt: new Date(conv.updatedAt),
  }
}

// Generate title from first message
export function generateConversationTitle(firstMessage: string): string {
  const maxLength = 50
  const cleaned = firstMessage.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
  return cleaned.slice(0, maxLength - 3) + '...'
}

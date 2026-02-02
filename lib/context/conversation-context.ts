import type { Conversation, ConversationMessage } from '@/types/conversation'
import type { KnowledgeReference } from '@/types/knowledge'

export interface ConversationContextOptions {
  readonly conversation: Conversation
  readonly maxMessages?: number
  readonly maxTokensEstimate?: number
}

export interface ConversationContextResult {
  readonly contextString: string
  readonly messageCount: number
  readonly includedMessages: readonly ConversationMessage[]
  readonly topicSummary: string
}

const APPROX_CHARS_PER_TOKEN = 4
const DEFAULT_MAX_MESSAGES = 10
const DEFAULT_MAX_TOKENS = 4000 // Increased for better context

/**
 * Extract key topics and entities mentioned in the conversation
 */
function extractConversationTopics(messages: readonly ConversationMessage[]): string[] {
  const topics = new Set<string>()

  // Common words to filter out
  const stopWords = new Set([
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer',
    'und', 'oder', 'aber', 'wenn', 'weil', 'dass', 'ist', 'sind', 'war',
    'hat', 'haben', 'mit', 'von', 'zu', 'bei', 'für', 'auf', 'in', 'an',
    'ich', 'du', 'wir', 'sie', 'es', 'nicht', 'auch', 'nur', 'noch',
    'was', 'wer', 'wie', 'wo', 'wann', 'warum', 'kann', 'werden', 'wurde',
    'gibt', 'dazu', 'dabei', 'damit', 'darüber', 'hier', 'dort', 'jetzt',
    'dann', 'also', 'sehr', 'mehr', 'alle', 'alles', 'keine', 'kein',
  ])

  for (const msg of messages) {
    // Extract capitalized words (likely names, projects, etc.)
    const capitalizedWords = msg.content.match(/[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*/g) || []
    for (const word of capitalizedWords) {
      if (word.length > 2 && !stopWords.has(word.toLowerCase())) {
        topics.add(word)
      }
    }

    // Extract quoted terms
    const quotedTerms = msg.content.match(/"([^"]+)"/g) || []
    for (const term of quotedTerms) {
      topics.add(term.replace(/"/g, ''))
    }

    // Extract terms after "Projekt", "über", "bezüglich", etc.
    const projectMatches = msg.content.match(/(?:Projekt|projekt|Project|über|bezüglich|betreffend|zum Thema)\s+([A-ZÄÖÜa-zäöüß0-9\-_]+)/gi) || []
    for (const match of projectMatches) {
      const term = match.split(/\s+/).slice(1).join(' ')
      if (term.length > 1) {
        topics.add(term)
      }
    }
  }

  return Array.from(topics).slice(0, 10) // Limit to top 10 topics
}

/**
 * Builds a comprehensive context string from conversation history
 */
export function buildConversationContext(
  options: ConversationContextOptions
): ConversationContextResult {
  const {
    conversation,
    maxMessages = DEFAULT_MAX_MESSAGES,
    maxTokensEstimate = DEFAULT_MAX_TOKENS,
  } = options

  if (conversation.messages.length === 0) {
    return {
      contextString: '',
      messageCount: 0,
      includedMessages: [],
      topicSummary: '',
    }
  }

  // Take the most recent N messages
  const recentMessages = conversation.messages.slice(-maxMessages)

  // Extract topics from ALL messages for better understanding
  const topics = extractConversationTopics(conversation.messages)
  const topicSummary = topics.length > 0
    ? `Hauptthemen der Konversation: ${topics.join(', ')}`
    : ''

  // Build context string with full messages (less truncation)
  const lines: string[] = []

  // Add topic summary at the top if available
  if (topicSummary) {
    lines.push(topicSummary)
    lines.push('')
  }

  lines.push('Bisheriger Gesprächsverlauf:')
  lines.push('')

  let totalChars = topicSummary.length
  const maxChars = maxTokensEstimate * APPROX_CHARS_PER_TOKEN
  const includedMessages: ConversationMessage[] = []

  for (const msg of recentMessages) {
    const roleLabel = msg.role === 'user' ? 'NUTZER' : 'ASSISTENT'
    // Allow longer messages for better context (1500 chars instead of 500)
    const content =
      msg.content.length > 1500 ? msg.content.slice(0, 1500) + '...' : msg.content
    const line = `[${roleLabel}]: ${content}`

    if (totalChars + line.length > maxChars) break

    lines.push(line)
    lines.push('') // Empty line between messages for readability
    totalChars += line.length
    includedMessages.push(msg)
  }

  return {
    contextString: lines.join('\n'),
    messageCount: includedMessages.length,
    includedMessages,
    topicSummary,
  }
}

/**
 * Creates a detailed instruction for the AI to use conversation context
 */
export function buildConversationInstruction(
  conversation: Conversation,
  currentQuery: string
): string {
  // We need at least 2 messages (previous + current) for meaningful context
  // A single message means this is the first question - no previous context
  if (conversation.messages.length <= 1) {
    return ''
  }

  // Exclude the current message from conversation context
  // We only want PREVIOUS messages for context
  const previousMessages = conversation.messages.slice(0, -1)

  if (previousMessages.length === 0) {
    return ''
  }

  const result = buildConversationContext({
    conversation: {
      ...conversation,
      messages: previousMessages,
    },
    maxMessages: 8,
    maxTokensEstimate: 3000,
  })

  if (result.messageCount === 0) {
    return ''
  }

  // Analyze the current query to see if it's likely a follow-up
  const isLikelyFollowUp = isImplicitFollowUp(currentQuery)

  const instructions = isLikelyFollowUp
    ? `
WICHTIG: Dies ist eine FOLGEFRAGE zu einer laufenden Konversation!
Der Nutzer bezieht sich auf vorherige Nachrichten - auch wenn er das Thema nicht explizit wiederholt.
Nutze den Konversationsverlauf, um zu verstehen, WORÜBER der Nutzer spricht.

${result.contextString}

Die aktuelle Frage "${currentQuery}" bezieht sich auf das oben besprochene Thema.
Beantworte die Frage im Kontext der bisherigen Konversation.
`
    : `
Der Nutzer führt eine Konversation. Hier ist der bisherige Verlauf:

${result.contextString}

Beantworte die folgende Anfrage. Falls sie sich auf vorherige Themen bezieht, nutze den Kontext.
`

  return instructions
}

/**
 * Check if a query is likely an implicit follow-up (doesn't mention the topic explicitly)
 */
function isImplicitFollowUp(query: string): boolean {
  const trimmed = query.trim().toLowerCase()

  // Queries starting with question words without a clear subject
  // These are strong indicators of follow-up questions
  const implicitPatterns = [
    /^wer\s+(hat|ist|war|sind|waren|noch|sonst|alles)/i,
    /^was\s+(ist|war|sind|waren|gibt|noch|genau)/i,
    /^wie\s+(viele?|lange?|oft|genau|war|ist)/i,
    /^wann\s+(ist|war|wird|wurde|hat)/i,
    /^wo\s+(ist|war|wird|wurde|hat)/i,
    /^warum\s+(ist|war|wird|wurde|hat)/i,
    /^welche[rs]?\s/i,
    /^gibt\s+es\s+(noch|weitere|andere)/i,
    /^waren?\s+(da\s+)?(noch|keine|weitere)/i,
    /^und\s/i,
    /^aber\s/i,
    /^also\s/i,
    /^sonst\s/i,
    /^außerdem/i,
    /^zusätzlich/i,
    /^noch\s+(mehr|weitere|andere)/i,
    /^mehr\s+(dazu|davon|details)/i,
    /^genauer/i,
    /^erkläre?\s+(das|mehr|genauer)/i,
  ]

  return implicitPatterns.some(p => p.test(trimmed))
}

/**
 * Extracts relevant references from conversation history
 */
export function extractConversationReferences(
  conversation: Conversation,
  limit: number = 5
): readonly KnowledgeReference[] {
  const references: KnowledgeReference[] = []

  // Collect all used references from messages (prioritize recent ones)
  const reversedMessages = [...conversation.messages].reverse()

  for (const msg of reversedMessages) {
    if (msg.metadata?.usedContext) {
      for (const ref of msg.metadata.usedContext) {
        // Avoid duplicates
        if (!references.some((r) => r.id === ref.id)) {
          references.push(ref)
        }
        if (references.length >= limit) break
      }
    }
    if (references.length >= limit) break
  }

  return references
}

/**
 * Checks if a message appears to be a follow-up question
 */
export function isFollowUpQuestion(text: string): boolean {
  const trimmed = text.trim().toLowerCase()

  // Common follow-up patterns in German
  const patterns = [
    /^und\s/,
    /^was\s+ist\s+damit/,
    /^wie\s+meinst\s+du/,
    /^kannst\s+du/,
    /^mehr\s+dazu/,
    /^genauer/,
    /^erkl[aä]r/,
    /^warum/,
    /^wieso/,
    /^noch\s+eine/,
    /^dazu/,
    /^wer\s+(noch|sonst|alles|hat)/,
    /^was\s+(noch|sonst|genau)/,
    /^gibt\s+es/,
    /^waren\s+(da\s+)?(noch|keine)/,
  ]

  return patterns.some((p) => p.test(trimmed))
}

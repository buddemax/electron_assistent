import type { Mode } from '@/types/output'

export type Intent =
  | 'birthday_query'
  | 'schedule_query'
  | 'person_query'
  | 'project_query'
  | 'knowledge_store'
  | 'email_compose'
  | 'todo_create'
  | 'knowledge_delete'
  | 'general_question'

export interface IntentDetectionResult {
  readonly intent: Intent
  readonly confidence: number
  readonly extractedEntity?: string
  readonly keywords: readonly string[]
}

interface KeywordPattern {
  readonly intent: Intent
  readonly patterns: readonly RegExp[]
  readonly extractEntity?: (match: RegExpMatchArray) => string | undefined
}

const KEYWORD_PATTERNS: readonly KeywordPattern[] = [
  {
    intent: 'birthday_query',
    patterns: [
      /wer\s+hat\s+(demnächst\s+)?geburtstag/i,
      /geburtstage?\s+(diese|nächste)\s+woche/i,
      /wann\s+hat\s+(.+)\s+geburtstag/i,
      /geburtstag\s+von\s+(.+)/i,
    ],
    extractEntity: (match) => match[1] || match[2],
  },
  {
    intent: 'schedule_query',
    patterns: [
      /was\s+steht\s+(heute|morgen|diese\s+woche|nächste\s+woche)\s+an/i,
      /wann\s+ist\s+(.+)/i,
      /termine?\s+(heute|morgen|diese\s+woche)/i,
      /kalender\s+(heute|morgen)/i,
      /meine\s+termine/i,
    ],
    extractEntity: (match) => match[1],
  },
  {
    intent: 'person_query',
    patterns: [
      /was\s+weiß\s+ich\s+über\s+(.+)/i,
      /wer\s+ist\s+(.+)/i,
      /informationen?\s+(zu|über)\s+(.+)/i,
      /erzähl\s+mir\s+(etwas\s+)?über\s+(.+)/i,
    ],
    extractEntity: (match) => match[1] || match[2] || match[3],
  },
  {
    intent: 'project_query',
    patterns: [
      /status\s+projekt\s+(.+)/i,
      /wie\s+steht\s+es\s+(um|mit)\s+projekt\s+(.+)/i,
      /projekt\s+(.+)\s+status/i,
      /stand\s+(von\s+)?projekt\s+(.+)/i,
    ],
    extractEntity: (match) => match[1] || match[2],
  },
  {
    intent: 'knowledge_store',
    patterns: [
      /^merke?\s*:\s*(.+)/i,
      /speicher(e|n)?\s*:\s*(.+)/i,
      /notier(e|en)?\s*:\s*(.+)/i,
      /erinner(e|n)?\s*mich\s*:\s*(.+)/i,
    ],
    extractEntity: (match) => match[1] || match[2],
  },
  {
    intent: 'email_compose',
    patterns: [
      /^mail\s+an\s+(.+)/i,
      /^email\s+an\s+(.+)/i,
      /schreib(e)?\s+(eine\s+)?mail\s+an\s+(.+)/i,
      /schreib(e)?\s+(eine\s+)?email\s+an\s+(.+)/i,
    ],
    extractEntity: (match) => match[1] || match[3],
  },
  {
    intent: 'todo_create',
    patterns: [
      /^aufgabe\s*:\s*(.+)/i,
      /^todo\s*:\s*(.+)/i,
      /neue\s+aufgabe\s*:\s*(.+)/i,
      /erstell(e)?\s+(eine\s+)?aufgabe\s*:\s*(.+)/i,
    ],
    extractEntity: (match) => match[1] || match[3],
  },
  {
    intent: 'knowledge_delete',
    patterns: [
      /^vergiss\s+(.+)/i,
      /^lösche?\s+(.+)/i,
      /entfern(e|en)?\s+(.+)\s+aus\s+(der\s+)?knowledge\s+base/i,
    ],
    extractEntity: (match) => match[1] || match[2],
  },
]

const QUESTION_INDICATORS = [
  /\?$/,
  /^(was|wer|wann|wo|wie|warum|weshalb|wieso|welche[rs]?)\s+/i,
  /^(ist|sind|hat|haben|kann|können|darf|dürfen|soll|sollte)\s+/i,
  /^(gibt\s+es|existiert|kennt|weiß)/i,
]

/**
 * Detect intent from transcribed text using keyword patterns
 */
export function detectIntent(text: string): IntentDetectionResult {
  const normalizedText = text.trim()

  // Check keyword patterns first
  for (const pattern of KEYWORD_PATTERNS) {
    for (const regex of pattern.patterns) {
      const match = normalizedText.match(regex)
      if (match) {
        const extractedEntity = pattern.extractEntity?.(match)?.trim()
        return {
          intent: pattern.intent,
          confidence: 0.9,
          extractedEntity,
          keywords: [match[0]],
        }
      }
    }
  }

  // Check for general questions
  for (const indicator of QUESTION_INDICATORS) {
    if (indicator.test(normalizedText)) {
      return {
        intent: 'general_question',
        confidence: 0.7,
        keywords: [],
      }
    }
  }

  // Default to general_question with low confidence
  return {
    intent: 'general_question',
    confidence: 0.5,
    keywords: [],
  }
}

/**
 * Check if intent requires context retrieval
 */
export function requiresContextRetrieval(intent: Intent): boolean {
  const contextIntents: readonly Intent[] = [
    'birthday_query',
    'schedule_query',
    'person_query',
    'project_query',
    'general_question',
  ]
  return contextIntents.includes(intent)
}

/**
 * Check if intent is a command (no output generation needed)
 */
export function isCommandIntent(intent: Intent): boolean {
  const commandIntents: readonly Intent[] = [
    'knowledge_store',
    'knowledge_delete',
  ]
  return commandIntents.includes(intent)
}

/**
 * Get the output type suggestion based on intent
 */
export function getOutputTypeFromIntent(intent: Intent): string | undefined {
  const mapping: Partial<Record<Intent, string>> = {
    email_compose: 'email',
    todo_create: 'todo',
    general_question: 'question',
  }
  return mapping[intent]
}

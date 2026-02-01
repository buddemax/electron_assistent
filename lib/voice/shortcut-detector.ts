import type { Mode } from '@/types/output'

export type ShortcutType =
  | 'store_knowledge'
  | 'email_compose'
  | 'todo_create'
  | 'knowledge_query'
  | 'knowledge_delete'
  | 'mode_switch'
  | 'none'

export interface ShortcutDetectionResult {
  readonly type: ShortcutType
  readonly extractedContent: string
  readonly extractedTarget?: string
  readonly newMode?: Mode
  readonly skipGeneration: boolean
  readonly confirmationMessage?: string
}

interface ShortcutPattern {
  readonly type: ShortcutType
  readonly patterns: readonly RegExp[]
  readonly extractContent: (match: RegExpMatchArray, fullText: string) => {
    content: string
    target?: string
    newMode?: Mode
  }
  readonly skipGeneration: boolean
  readonly getConfirmation?: (content: string, target?: string, newMode?: Mode) => string
}

const SHORTCUT_PATTERNS: readonly ShortcutPattern[] = [
  {
    type: 'store_knowledge',
    patterns: [
      /^merke?\s*:\s*(.+)/i,
      /^speicher(e|n)?\s*:\s*(.+)/i,
      /^notier(e|en)?\s*:\s*(.+)/i,
      /^erinner(e|n)?\s*mich\s*:\s*(.+)/i,
    ],
    extractContent: (match, fullText) => ({
      content: match[1] || match[2] || fullText.replace(/^[^:]+:\s*/, ''),
    }),
    skipGeneration: true,
    getConfirmation: (content) => `Gespeichert: "${content.slice(0, 50)}${content.length > 50 ? '...' : ''}"`,
  },
  {
    type: 'email_compose',
    patterns: [
      /^mail\s+an\s+([^:]+):\s*(.+)/i,
      /^email\s+an\s+([^:]+):\s*(.+)/i,
      /^schreib(e)?\s+(eine\s+)?mail\s+an\s+([^:]+):\s*(.+)/i,
      /^schreib(e)?\s+(eine\s+)?email\s+an\s+([^:]+):\s*(.+)/i,
    ],
    extractContent: (match, fullText) => {
      // Different patterns have target in different groups
      if (match[3] && match[4]) {
        return { content: match[4], target: match[3].trim() }
      }
      if (match[1] && match[2]) {
        return { content: match[2], target: match[1].trim() }
      }
      return { content: fullText, target: undefined }
    },
    skipGeneration: false, // Email needs generation, but with recipient context
  },
  {
    type: 'todo_create',
    patterns: [
      /^aufgabe\s*:\s*(.+)/i,
      /^todo\s*:\s*(.+)/i,
      /^neue\s+aufgabe\s*:\s*(.+)/i,
      /^erstell(e)?\s+(eine\s+)?aufgabe\s*:\s*(.+)/i,
    ],
    extractContent: (match, fullText) => ({
      content: match[1] || match[3] || fullText.replace(/^[^:]+:\s*/, ''),
    }),
    skipGeneration: false, // Todo needs generation for structured output
  },
  {
    type: 'knowledge_query',
    patterns: [
      /^was\s+weiß\s+ich\s+über\s+(.+)\??/i,
      /^was\s+wissen\s+wir\s+über\s+(.+)\??/i,
      /^informationen?\s+(zu|über)\s+(.+)/i,
    ],
    extractContent: (match) => ({
      content: match[1] || match[2] || '',
      target: match[1] || match[2],
    }),
    skipGeneration: false, // Query needs context-aware generation
  },
  {
    type: 'knowledge_delete',
    patterns: [
      /^vergiss\s+(.+)/i,
      /^lösche?\s+(.+)\s*aus\s+(der\s+)?knowledge\s+base/i,
      /^entfern(e|en)?\s+(.+)\s*aus\s+(der\s+)?knowledge\s+base/i,
    ],
    extractContent: (match) => ({
      content: match[1] || match[2] || '',
      target: match[1] || match[2],
    }),
    skipGeneration: true,
    getConfirmation: (content) => `Gelöscht: Einträge zu "${content}"`,
  },
  {
    type: 'mode_switch',
    patterns: [
      /^wechsel(e|n)?\s+(zu\s+)?(privat|beruflich)/i,
      /^modus\s+(privat|beruflich)/i,
      /^(privat|beruflich)\s*modus/i,
    ],
    extractContent: (match) => {
      const modeText = match[3] || match[1]
      const newMode: Mode = modeText?.toLowerCase() === 'privat' ? 'private' : 'work'
      return { content: '', newMode }
    },
    skipGeneration: true,
    getConfirmation: (_, __, newMode) =>
      `Modus gewechselt zu: ${newMode === 'private' ? 'Privat' : 'Beruflich'}`,
  },
]

/**
 * Detect voice shortcuts in transcribed text
 */
export function detectShortcut(text: string): ShortcutDetectionResult {
  const normalizedText = text.trim()

  for (const pattern of SHORTCUT_PATTERNS) {
    for (const regex of pattern.patterns) {
      const match = normalizedText.match(regex)
      if (match) {
        const { content, target, newMode } = pattern.extractContent(match, normalizedText)

        let confirmationMessage: string | undefined
        if (pattern.getConfirmation) {
          confirmationMessage = pattern.getConfirmation(content, target, newMode)
        }

        return {
          type: pattern.type,
          extractedContent: content,
          extractedTarget: target,
          newMode,
          skipGeneration: pattern.skipGeneration,
          confirmationMessage,
        }
      }
    }
  }

  return {
    type: 'none',
    extractedContent: normalizedText,
    skipGeneration: false,
  }
}

/**
 * Check if shortcut requires immediate action without AI generation
 */
export function isImmediateAction(type: ShortcutType): boolean {
  return type === 'store_knowledge' || type === 'knowledge_delete' || type === 'mode_switch'
}

/**
 * Get modified transcription for generation (with recipient context for emails)
 */
export function getModifiedTranscription(result: ShortcutDetectionResult): string {
  if (result.type === 'email_compose' && result.extractedTarget) {
    return `Schreibe eine E-Mail an ${result.extractedTarget}: ${result.extractedContent}`
  }
  if (result.type === 'todo_create') {
    return `Aufgabe: ${result.extractedContent}`
  }
  return result.extractedContent
}

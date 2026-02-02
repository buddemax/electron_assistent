import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import type { OutputType, OutputVariant, Mode, GeneratedOutput } from '@/types/output'
import type { KnowledgeReference } from '@/types/knowledge'
import type { UserProfile } from '@/types/profile'
import { buildProfileContext } from '@/lib/ai/profile-prompt'
import { v4 as uuidv4 } from 'uuid'

let genAI: GoogleGenerativeAI | null = null
let model: GenerativeModel | null = null

interface GeminiClientOptions {
  maxOutputTokens?: number
  temperature?: number
}

export function getGeminiClient(apiKey?: string, options?: GeminiClientOptions): GenerativeModel {
  const key = apiKey || process.env.GEMINI_API_KEY
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const maxTokens = options?.maxOutputTokens ?? 2048
  const temperature = options?.temperature ?? 0.7

  // Always create fresh client when options are provided or apiKey changes
  if (!genAI || apiKey || options) {
    genAI = new GoogleGenerativeAI(key)
    model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature,
        topP: 0.9,
        maxOutputTokens: maxTokens,
      },
    })
  }

  if (!model) {
    throw new Error('Failed to initialize Gemini model')
  }

  return model
}

export interface GenerateOptions {
  transcription: string
  mode: Mode
  outputType?: OutputType
  variant: OutputVariant
  context?: readonly KnowledgeReference[]
  customInstructions?: string
  language?: 'de' | 'en'
  profile?: UserProfile
  conversationContext?: string
}

export interface GenerateResult {
  outputs: {
    short: GeneratedOutput
    standard: GeneratedOutput
    detailed: GeneratedOutput
  }
  detectedType: OutputType
  usedContext: readonly KnowledgeReference[]
}

// Output type detection prompt
const OUTPUT_TYPE_DETECTION_PROMPT = `Analysiere den folgenden Text und bestimme den am besten passenden Output-Typ.

Mögliche Typen:
- email: Texte die nach einer E-Mail klingen ("schreib eine Mail an...", "Email an...", enthält Empfänger)
- meeting-note: Meeting-bezogen ("Meeting Notizen", "Besprechung", Teilnehmer, Action Items)
- todo: Aufgaben ("Aufgabe:", "Todo:", "ich muss...", "erledigen")
- question: Fragen ("Was weiß ich über...", "Wie funktioniert...", Fragezeichen)
- brainstorm: Ideen sammeln ("Ideen für...", "Brainstorming", kreative Sammlung)
- summary: Zusammenfassen ("Fasse zusammen...", "Summary von...")
- code: Code-bezogen ("Code für...", "Programmiere...", technische Implementierung)
- general: Alles andere

Text: """
{TEXT}
"""

Antworte NUR mit dem Typ-Namen (z.B. "email" oder "todo"), nichts anderes.`

const VARIANT_INSTRUCTIONS = {
  short: 'Halte es kurz und prägnant. Maximal 2-3 Sätze.',
  standard: 'Ausgewogene Länge mit allen wichtigen Details.',
  detailed: 'Ausführlich mit allen Details und Kontext.',
}

// JSON-basierte Prompts für strukturierte, saubere Outputs
const OUTPUT_TYPE_PROMPTS: Record<OutputType, string> = {
  email: `Erstelle eine professionelle E-Mail.

WICHTIG: Antworte NUR mit gültigem JSON in exakt diesem Format:
{
  "to": "Empfänger Name oder E-Mail",
  "subject": "Betreffzeile",
  "body": "Der vollständige E-Mail-Text ohne Anrede und Grußformel",
  "greeting": "Sehr geehrter Herr/Frau...",
  "closing": "Mit freundlichen Grüßen"
}

Regeln:
- Der "body" enthält NUR den Inhalt - KEINE Anrede, KEINE Grußformel, KEINE Labels
- Kein Markdown im body, nur Zeilenumbrüche für Absätze
- Professionell aber natürlich formuliert
- Keine Einleitungen wie "Hier ist..." oder "Absolut!"`,

  'meeting-note': `Erstelle strukturierte Meeting-Notizen.

WICHTIG: Antworte NUR mit gültigem JSON in exakt diesem Format:
{
  "title": "Meeting-Titel",
  "date": "Datum",
  "attendees": ["Teilnehmer 1", "Teilnehmer 2"],
  "topics": ["Thema 1", "Thema 2"],
  "decisions": ["Entscheidung 1"],
  "actionItems": [{"task": "Aufgabe", "owner": "Verantwortlicher", "due": "Deadline"}],
  "notes": "Zusätzliche Notizen"
}`,

  todo: `Erstelle eine Aufgabenliste.

WICHTIG: Antworte NUR mit gültigem JSON in exakt diesem Format:
{
  "title": "Hauptaufgabe oder Projekttitel",
  "items": [
    {"text": "Aufgabe 1", "priority": "high"},
    {"text": "Aufgabe 2", "priority": "medium"}
  ],
  "deadline": "Falls erwähnt, sonst null",
  "notes": "Zusätzliche Hinweise"
}

Priority: "high", "medium", oder "low"`,

  question: `Beantworte die Frage basierend auf dem bereitgestellten Kontext.

WICHTIG: Antworte NUR mit gültigem JSON in exakt diesem Format:
{
  "question": "Die gestellte Frage",
  "answer": "Deine Antwort - basierend auf dem Kontext",
  "confidence": "high/medium/low",
  "sources": "Welche Quellen verwendet wurden, z.B. 'Kalender', 'Kontakte', 'Knowledge Base'"
}

Regeln:
- VERWENDE den bereitgestellten Kontext! Der Kontext enthält relevante Informationen.
- Bei Kalender-Fragen: Liste die Termine aus dem Kontext auf
- Bei Personen-Fragen: Verwende die Informationen aus dem Kontext
- Nur wenn KEIN Kontext vorhanden ist, sage "Dazu habe ich keine Information"
- Strukturiere Kalender-Einträge übersichtlich mit Datum und Uhrzeit`,

  brainstorm: `Erstelle eine Ideensammlung.

WICHTIG: Antworte NUR mit gültigem JSON in exakt diesem Format:
{
  "topic": "Hauptthema",
  "ideas": [
    {"title": "Idee 1", "description": "Kurze Beschreibung"},
    {"title": "Idee 2", "description": "Kurze Beschreibung"}
  ],
  "categories": ["Kategorie 1", "Kategorie 2"]
}`,

  summary: `Erstelle eine Zusammenfassung.

WICHTIG: Antworte NUR mit gültigem JSON in exakt diesem Format:
{
  "title": "Titel der Zusammenfassung",
  "keyPoints": ["Punkt 1", "Punkt 2", "Punkt 3"],
  "conclusion": "Fazit in einem Satz",
  "fullSummary": "Ausführlichere Zusammenfassung als Fließtext"
}`,

  code: `Erstelle Code basierend auf der Anfrage.

WICHTIG: Antworte NUR mit gültigem JSON in exakt diesem Format:
{
  "language": "Programmiersprache",
  "code": "Der Code hier",
  "explanation": "Kurze Erklärung was der Code macht",
  "usage": "Beispiel wie man den Code verwendet"
}`,

  general: `Verarbeite die Anfrage und erstelle einen hilfreichen Output.

WICHTIG: Antworte NUR mit gültigem JSON in exakt diesem Format:
{
  "title": "Passender Titel",
  "content": "Der Hauptinhalt - gut strukturiert",
  "summary": "Kurze Zusammenfassung"
}

Regeln:
- Erkenne die Intention
- Kein Markdown, nur Zeilenumbrüche
- Keine Einleitungen wie "Hier ist..."`,
}

export async function detectOutputType(
  text: string,
  apiKey: string
): Promise<OutputType> {
  const model = getGeminiClient(apiKey)

  const prompt = OUTPUT_TYPE_DETECTION_PROMPT.replace('{TEXT}', text)
  const result = await model.generateContent(prompt)
  const response = result.response.text().trim().toLowerCase()

  const validTypes: OutputType[] = [
    'email',
    'meeting-note',
    'todo',
    'question',
    'brainstorm',
    'summary',
    'code',
    'general',
  ]

  if (validTypes.includes(response as OutputType)) {
    return response as OutputType
  }

  return 'general'
}

export async function generateOutput(
  options: GenerateOptions,
  apiKey: string
): Promise<GenerateResult> {
  const model = getGeminiClient(apiKey)

  // Detect output type if not provided
  const outputType =
    options.outputType || (await detectOutputType(options.transcription, apiKey))

  // Build context string
  let contextString = ''
  if (options.context && options.context.length > 0) {
    contextString = `\n\nRelevanter Kontext:\n${options.context
      .map((c) => `- ${c.snippet}`)
      .join('\n')}`
  }

  // Build profile context if available
  const profileContext = options.profile ? buildProfileContext(options.profile) : ''

  // Generate all three variants
  const variants: OutputVariant[] = ['short', 'standard', 'detailed']
  const outputs: Record<OutputVariant, GeneratedOutput> = {} as Record<OutputVariant, GeneratedOutput>

  for (const variant of variants) {
    // For questions, put context BEFORE the instructions so the AI sees it first
    const contextSection = contextString ? `
=== VERFÜGBARER KONTEXT ===
${contextString}
=== ENDE KONTEXT ===
` : ''

    // Include conversation history if available - this is critical for follow-up questions
    const conversationSection = options.conversationContext ? `
=== KONVERSATIONSKONTEXT ===
${options.conversationContext}
=== ENDE KONVERSATIONSKONTEXT ===
` : ''

    const systemPrompt = `Du bist ein Assistent der strukturierte Outputs auf Deutsch generiert.
${options.mode === 'work' ? 'Kontext: Beruflich - professioneller Ton.' : 'Kontext: Privat - freundlicher Ton.'}
${VARIANT_INSTRUCTIONS[variant]}
${options.customInstructions || ''}${profileContext}

${conversationSection ? `KONVERSATION AKTIV: Der Nutzer führt ein fortlaufendes Gespräch.
Wenn die aktuelle Frage keine spezifischen Themen erwähnt, beziehe sie auf die vorherige Konversation.
Fragen wie "wer war dabei?", "und sonst noch?", "gibt es weitere?" beziehen sich auf das zuvor besprochene Thema.

${conversationSection}` : ''}

${contextSection}
${OUTPUT_TYPE_PROMPTS[outputType]}

KRITISCH: Antworte AUSSCHLIESSLICH mit gültigem JSON. Kein Text davor oder danach.`

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${systemPrompt}\n\nEingabe: "${options.transcription}"`,
            },
          ],
        },
      ],
    })

    const responseText = result.response.text().trim()
    const { structured, displayBody, title } = parseAndFormatOutput(responseText, outputType)

    outputs[variant] = {
      id: uuidv4(),
      type: outputType,
      variant,
      mode: options.mode,
      content: {
        title,
        body: displayBody,
        structured,
      },
      originalTranscription: options.transcription,
      metadata: {
        wordCount: displayBody.split(/\s+/).length,
        estimatedReadTime: Math.ceil(displayBody.split(/\s+/).length / 200),
        suggestedActions: getSuggestedActions(outputType),
        relatedKnowledge: options.context || [],
      },
      createdAt: new Date(),
    }
  }

  return {
    outputs: {
      short: outputs.short,
      standard: outputs.standard,
      detailed: outputs.detailed,
    },
    detectedType: outputType,
    usedContext: options.context || [],
  }
}

interface ParsedOutput {
  structured: Record<string, unknown>
  displayBody: string
  title?: string
}

function parseAndFormatOutput(text: string, type: OutputType): ParsedOutput {
  // Try to parse as JSON
  let parsed: Record<string, unknown> = {}

  try {
    // Clean up potential markdown code blocks
    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7)
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3)
    }
    parsed = JSON.parse(jsonText.trim())
  } catch {
    // If JSON parsing fails, return the raw text
    return {
      structured: {},
      displayBody: text,
      title: undefined,
    }
  }

  // Format based on output type
  switch (type) {
    case 'email': {
      const greeting = (parsed.greeting as string) || 'Sehr geehrte Damen und Herren,'
      const body = (parsed.body as string) || ''
      const closing = (parsed.closing as string) || 'Mit freundlichen Grüßen'

      // Create a clean, copy-paste ready email body
      const displayBody = `${greeting}\n\n${body}\n\n${closing}`

      return {
        structured: parsed,
        displayBody,
        title: parsed.subject as string,
      }
    }

    case 'meeting-note': {
      const lines: string[] = []
      if (parsed.date) lines.push(`Datum: ${parsed.date}`)
      if (parsed.attendees && Array.isArray(parsed.attendees)) {
        lines.push(`Teilnehmer: ${(parsed.attendees as string[]).join(', ')}`)
      }
      lines.push('')
      if (parsed.topics && Array.isArray(parsed.topics)) {
        lines.push('Themen:')
        ;(parsed.topics as string[]).forEach(t => lines.push(`• ${t}`))
        lines.push('')
      }
      if (parsed.decisions && Array.isArray(parsed.decisions) && (parsed.decisions as string[]).length > 0) {
        lines.push('Entscheidungen:')
        ;(parsed.decisions as string[]).forEach(d => lines.push(`• ${d}`))
        lines.push('')
      }
      if (parsed.actionItems && Array.isArray(parsed.actionItems)) {
        lines.push('Action Items:')
        ;(parsed.actionItems as Array<{task: string; owner?: string; due?: string}>).forEach(item => {
          let line = `• ${item.task}`
          if (item.owner) line += ` → ${item.owner}`
          if (item.due) line += ` (bis ${item.due})`
          lines.push(line)
        })
      }
      if (parsed.notes) {
        lines.push('')
        lines.push(parsed.notes as string)
      }

      return {
        structured: parsed,
        displayBody: lines.join('\n'),
        title: parsed.title as string,
      }
    }

    case 'todo': {
      const lines: string[] = []
      if (parsed.items && Array.isArray(parsed.items)) {
        ;(parsed.items as Array<{text: string; priority?: string}>).forEach(item => {
          const priority = item.priority === 'high' ? '❗' : item.priority === 'medium' ? '•' : '○'
          lines.push(`${priority} ${item.text}`)
        })
      }
      if (parsed.deadline) {
        lines.push('')
        lines.push(`Deadline: ${parsed.deadline}`)
      }
      if (parsed.notes) {
        lines.push('')
        lines.push(parsed.notes as string)
      }

      return {
        structured: parsed,
        displayBody: lines.join('\n'),
        title: parsed.title as string,
      }
    }

    case 'question': {
      return {
        structured: parsed,
        displayBody: (parsed.answer as string) || text,
        title: parsed.question as string,
      }
    }

    case 'brainstorm': {
      const lines: string[] = []
      if (parsed.ideas && Array.isArray(parsed.ideas)) {
        ;(parsed.ideas as Array<{title: string; description?: string}>).forEach((idea, i) => {
          lines.push(`${i + 1}. ${idea.title}`)
          if (idea.description) lines.push(`   ${idea.description}`)
        })
      }

      return {
        structured: parsed,
        displayBody: lines.join('\n'),
        title: parsed.topic as string,
      }
    }

    case 'summary': {
      const lines: string[] = []
      if (parsed.keyPoints && Array.isArray(parsed.keyPoints)) {
        ;(parsed.keyPoints as string[]).forEach(point => lines.push(`• ${point}`))
      }
      if (parsed.conclusion) {
        lines.push('')
        lines.push(`Fazit: ${parsed.conclusion}`)
      }
      if (parsed.fullSummary) {
        lines.push('')
        lines.push(parsed.fullSummary as string)
      }

      return {
        structured: parsed,
        displayBody: lines.join('\n'),
        title: parsed.title as string,
      }
    }

    case 'code': {
      const lines: string[] = []
      if (parsed.explanation) {
        lines.push(parsed.explanation as string)
        lines.push('')
      }
      if (parsed.code) {
        lines.push('```' + ((parsed.language as string) || ''))
        lines.push(parsed.code as string)
        lines.push('```')
      }
      if (parsed.usage) {
        lines.push('')
        lines.push(`Verwendung: ${parsed.usage}`)
      }

      return {
        structured: parsed,
        displayBody: lines.join('\n'),
        title: `${parsed.language || 'Code'}`,
      }
    }

    default: {
      return {
        structured: parsed,
        displayBody: (parsed.content as string) || (parsed.fullSummary as string) || text,
        title: parsed.title as string,
      }
    }
  }
}

type ActionType = 'copy' | 'export' | 'save' | 'share' | 'edit'

function getSuggestedActions(type: OutputType): Array<{ type: ActionType; label: string; shortcut?: string }> {
  const baseActions: Array<{ type: ActionType; label: string; shortcut?: string }> = [
    { type: 'copy', label: 'Kopieren', shortcut: '⌘C' },
  ]

  switch (type) {
    case 'email':
      return [
        ...baseActions,
        { type: 'export' as ActionType, label: 'In Mail öffnen' },
      ]
    case 'code':
      return [
        ...baseActions,
        { type: 'export' as ActionType, label: 'In Editor öffnen' },
      ]
    default:
      return baseActions
  }
}

// Streaming generation
export async function* streamGeneration(
  options: GenerateOptions,
  apiKey: string
): AsyncGenerator<{ chunk: string } | { complete: GeneratedOutput }> {
  const model = getGeminiClient(apiKey)
  const outputType = options.outputType || await detectOutputType(options.transcription, apiKey)
  const profileContext = options.profile ? buildProfileContext(options.profile) : ''

  const systemPrompt = `Du bist ein Assistent der strukturierte Outputs auf Deutsch generiert.
${options.mode === 'work' ? 'Kontext: Beruflich - professioneller Ton.' : 'Kontext: Privat - freundlicher Ton.'}
${VARIANT_INSTRUCTIONS[options.variant]}${profileContext}

${OUTPUT_TYPE_PROMPTS[outputType]}

KRITISCH: Antworte AUSSCHLIESSLICH mit gültigem JSON. Kein Text davor oder danach.`

  const result = await model.generateContentStream({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `${systemPrompt}\n\nEingabe: "${options.transcription}"`,
          },
        ],
      },
    ],
  })

  let fullText = ''

  for await (const chunk of result.stream) {
    const text = chunk.text()
    fullText += text
    yield { chunk: text }
  }

  const { structured, displayBody, title } = parseAndFormatOutput(fullText, outputType)

  yield {
    complete: {
      id: uuidv4(),
      type: outputType,
      variant: options.variant,
      mode: options.mode,
      content: {
        title,
        body: displayBody,
        structured,
      },
      originalTranscription: options.transcription,
      metadata: {
        wordCount: displayBody.split(/\s+/).length,
        estimatedReadTime: Math.ceil(displayBody.split(/\s+/).length / 200),
        suggestedActions: getSuggestedActions(outputType),
        relatedKnowledge: options.context || [],
      },
      createdAt: new Date(),
    },
  }
}

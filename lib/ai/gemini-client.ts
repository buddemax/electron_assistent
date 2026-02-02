import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import { z } from 'zod'
import type { OutputType, OutputVariant, Mode, GeneratedOutput } from '@/types/output'
import type { KnowledgeReference } from '@/types/knowledge'
import type { UserProfile } from '@/types/profile'
import type { QuestionAnswer } from '@/types/daily-questions'
import { buildProfileContext, buildFullProfileContext } from '@/lib/ai/profile-prompt'
import { v4 as uuidv4 } from 'uuid'

// ==================== ZOD SCHEMAS FOR AI OUTPUTS ====================

const emailOutputSchema = z.object({
  to: z.string().optional().default(''),
  subject: z.string().optional().default(''),
  body: z.string().optional().default(''),
  greeting: z.string().optional().default('Sehr geehrte Damen und Herren,'),
  closing: z.string().optional().default('Mit freundlichen Grüßen'),
})

const meetingNoteOutputSchema = z.object({
  title: z.string().optional(),
  date: z.string().optional(),
  attendees: z.array(z.string()).optional().default([]),
  topics: z.array(z.string()).optional().default([]),
  decisions: z.array(z.string()).optional().default([]),
  actionItems: z.array(z.object({
    task: z.string(),
    owner: z.string().optional(),
    due: z.string().optional(),
  })).optional().default([]),
  notes: z.string().optional(),
})

const todoOutputSchema = z.object({
  title: z.string().optional(),
  items: z.array(z.object({
    text: z.string(),
    priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  })).optional().default([]),
  deadline: z.string().nullable().optional(),
  notes: z.string().optional(),
})

const noteOutputSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().optional(),
})

const questionOutputSchema = z.object({
  question: z.string().optional(),
  answer: z.string().optional().default(''),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  sources: z.string().optional(),
})

const brainstormOutputSchema = z.object({
  topic: z.string().optional(),
  ideas: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
  })).optional().default([]),
  categories: z.array(z.string()).optional().default([]),
})

const summaryOutputSchema = z.object({
  title: z.string().optional(),
  keyPoints: z.array(z.string()).optional().default([]),
  conclusion: z.string().optional(),
  fullSummary: z.string().optional(),
})

const calendarOutputSchema = z.object({
  event: z.object({
    title: z.string(),
    date: z.string(),
    time: z.string(),
    duration: z.number().optional().default(60),
    notes: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    attendees: z.array(z.string()).optional().default([]),
  }).optional(),
  formatted: z.object({
    dateDisplay: z.string(),
    timeDisplay: z.string(),
    durationDisplay: z.string(),
  }).optional(),
})

const generalOutputSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional().default(''),
  summary: z.string().optional(),
})

// Map output type to its schema
const outputSchemas: Record<OutputType, z.ZodType> = {
  email: emailOutputSchema,
  'meeting-note': meetingNoteOutputSchema,
  todo: todoOutputSchema,
  note: noteOutputSchema,
  question: questionOutputSchema,
  brainstorm: brainstormOutputSchema,
  summary: summaryOutputSchema,
  calendar: calendarOutputSchema,
  general: generalOutputSchema,
}

/**
 * Validate and parse AI-generated JSON with Zod
 * Returns parsed object with defaults applied, or null if validation fails
 */
function validateAIOutput<T>(
  rawData: unknown,
  schema: z.ZodType<T>
): T | null {
  const result = schema.safeParse(rawData)
  if (result.success) {
    return result.data
  }
  // Log validation errors for debugging (but don't fail - graceful degradation)
  console.warn('AI output validation warning:', result.error.flatten())
  return null
}

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
  dailyQuestionsAnswers?: readonly QuestionAnswer[]
  /** When true, only generate the specified variant instead of all three */
  singleVariant?: boolean
}

export interface GenerateResult {
  outputs: {
    short: GeneratedOutput | null
    standard: GeneratedOutput | null
    detailed: GeneratedOutput | null
  }
  detectedType: OutputType
  usedContext: readonly KnowledgeReference[]
  /** When singleVariant was used, indicates which variant was generated */
  generatedVariant?: OutputVariant
}

// Output type detection prompt
const OUTPUT_TYPE_DETECTION_PROMPT = `Analysiere den folgenden Text und bestimme den am besten passenden Output-Typ.

Mögliche Typen:
- email: Texte die nach einer E-Mail klingen ("schreib eine Mail an...", "Email an...", enthält Empfänger)
- meeting-note: Meeting-bezogen ("Meeting Notizen", "Besprechung", Teilnehmer, Action Items)
- todo: Aufgaben ("Aufgabe:", "Todo:", "ich muss...", "erledigen", Liste von Dingen)
- note: Notizen und Memos ("Notiz:", "merke dir...", "notiere...", "schreib auf...", kurze Gedanken festhalten)
- question: Fragen ("Was weiß ich über...", "Wie funktioniert...", Fragezeichen)
- brainstorm: Ideen sammeln ("Ideen für...", "Brainstorming", kreative Sammlung)
- summary: Zusammenfassen ("Fasse zusammen...", "Summary von...")
- calendar: Termine und Kalendereinträge ("Meeting am...", "Termin am Freitag um...", "Besprechung am...", enthält Datum UND Uhrzeit)
- general: Alles andere

Text: """
{TEXT}
"""

Antworte NUR mit dem Typ-Namen (z.B. "email" oder "note"), nichts anderes.`

const VARIANT_INSTRUCTIONS = {
  short: 'Halte es kurz und prägnant. Maximal 2-3 Sätze.',
  standard: 'Ausgewogene Länge mit allen wichtigen Details.',
  detailed: 'Ausführlich mit allen Details und Kontext.',
}

// Get the prompt for a specific output type (calendar needs dynamic date)
function getOutputTypePrompt(type: OutputType): string {
  if (type === 'calendar') {
    return getCalendarPrompt()
  }
  return OUTPUT_TYPE_PROMPTS[type]
}

// Helper function to generate calendar prompt with current date
function getCalendarPrompt(): string {
  const now = new Date()
  const germanDays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
  const germanMonths = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

  const todayStr = `${germanDays[now.getDay()]}, ${now.getDate()}. ${germanMonths[now.getMonth()]} ${now.getFullYear()}`
  const isoToday = now.toISOString().split('T')[0]

  // Calculate tomorrow
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = `${germanDays[tomorrow.getDay()]}, ${tomorrow.getDate()}. ${germanMonths[tomorrow.getMonth()]} ${tomorrow.getFullYear()}`
  const isoTomorrow = tomorrow.toISOString().split('T')[0]

  return `Extrahiere Kalenderdaten aus dem Text und erstelle einen Termin.

HEUTE IST: ${todayStr} (${isoToday})
MORGEN IST: ${tomorrowStr} (${isoTomorrow})

WICHTIG: Antworte NUR mit gültigem JSON in exakt diesem Format:
{
  "event": {
    "title": "Titel des Termins",
    "date": "${isoTomorrow}",
    "time": "09:00",
    "duration": 60,
    "notes": null,
    "location": null,
    "attendees": []
  },
  "formatted": {
    "dateDisplay": "${tomorrowStr}",
    "timeDisplay": "09:00 - 10:00 Uhr",
    "durationDisplay": "1 Stunde"
  }
}

KRITISCHE REGELN:
- "date" MUSS im ISO-Format YYYY-MM-DD sein (z.B. "${isoTomorrow}")
- "dateDisplay" MUSS das volle deutsche Datum sein (z.B. "${tomorrowStr}")
- "heute" = ${isoToday}
- "morgen" = ${isoTomorrow}
- Berechne andere Wochentage relativ zu heute (${germanDays[now.getDay()]})

Weitere Regeln:
- Erkenne Uhrzeiten: "14 Uhr" = "14:00", "halb drei" = "14:30", "9 Uhr bis 9.30" = Start 09:00, Ende 09:30 (30 Min)
- Wenn Endzeit angegeben: Berechne Dauer aus Start- und Endzeit
- Standard-Dauer falls nicht angegeben: 60 Minuten
- "mit mir selbst" oder keine Teilnehmer = leeres attendees Array
- Extrahiere Titel aus dem Kontext (z.B. "Termin mit Hans" = "Termin mit Hans")
- timeDisplay zeigt immer Start- UND Endzeit`
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

  note: `Erstelle eine Notiz oder ein Memo.

WICHTIG: Antworte NUR mit gültigem JSON in exakt diesem Format:
{
  "title": "Titel der Notiz",
  "content": "Der Inhalt der Notiz - klar und strukturiert",
  "tags": ["optional", "tags"],
  "category": "Optional: Kategorie wie 'Idee', 'Erinnerung', 'Wichtig'"
}

Regeln:
- Halte die Notiz prägnant und auf den Punkt
- Keine Einleitungen wie "Hier ist deine Notiz"
- Der Inhalt soll direkt verwendbar sein`,

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

  calendar: `KALENDER_PROMPT_PLACEHOLDER`,
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
    'note',
    'question',
    'brainstorm',
    'summary',
    'calendar',
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

  // Build profile context if available (including daily questions answers)
  const profileContext = options.profile
    ? buildFullProfileContext(options.profile, options.dailyQuestionsAnswers || [])
    : ''

  // Determine which variants to generate
  const variantsToGenerate: OutputVariant[] = options.singleVariant
    ? [options.variant]
    : ['short', 'standard', 'detailed']
  const outputs: Record<OutputVariant, GeneratedOutput | null> = {
    short: null,
    standard: null,
    detailed: null,
  }

  for (const variant of variantsToGenerate) {
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
${getOutputTypePrompt(outputType)}

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
    ...(options.singleVariant && { generatedVariant: options.variant }),
  }
}

interface ParsedOutput {
  structured: Record<string, unknown>
  displayBody: string
  title?: string
}

function parseAndFormatOutput(text: string, type: OutputType): ParsedOutput {
  // Try to parse as JSON
  let rawParsed: unknown = null

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
    rawParsed = JSON.parse(jsonText.trim())
  } catch {
    // If JSON parsing fails, return the raw text
    return {
      structured: {},
      displayBody: text,
      title: undefined,
    }
  }

  // Get the appropriate schema and validate
  const schema = outputSchemas[type]
  const validated = validateAIOutput(rawParsed, schema)

  // If validation completely fails, fall back to raw parsed data
  const parsed = validated ?? (rawParsed as Record<string, unknown>)

  // Format based on output type
  switch (type) {
    case 'email': {
      const emailData = emailOutputSchema.safeParse(parsed)
      if (emailData.success) {
        const { greeting, body, closing, subject } = emailData.data
        const displayBody = `${greeting}\n\n${body}\n\n${closing}`
        return {
          structured: parsed as Record<string, unknown>,
          displayBody,
          title: subject,
        }
      }
      // Fallback for malformed email
      return {
        structured: parsed as Record<string, unknown>,
        displayBody: text,
        title: undefined,
      }
    }

    case 'meeting-note': {
      const noteData = meetingNoteOutputSchema.safeParse(parsed)
      if (noteData.success) {
        const { title, date, attendees, topics, decisions, actionItems, notes } = noteData.data
        const lines: string[] = []
        if (date) lines.push(`Datum: ${date}`)
        if (attendees.length > 0) {
          lines.push(`Teilnehmer: ${attendees.join(', ')}`)
        }
        lines.push('')
        if (topics.length > 0) {
          lines.push('Themen:')
          topics.forEach(t => lines.push(`• ${t}`))
          lines.push('')
        }
        if (decisions.length > 0) {
          lines.push('Entscheidungen:')
          decisions.forEach(d => lines.push(`• ${d}`))
          lines.push('')
        }
        if (actionItems.length > 0) {
          lines.push('Action Items:')
          actionItems.forEach(item => {
            let line = `• ${item.task}`
            if (item.owner) line += ` → ${item.owner}`
            if (item.due) line += ` (bis ${item.due})`
            lines.push(line)
          })
        }
        if (notes) {
          lines.push('')
          lines.push(notes)
        }
        return {
          structured: parsed as Record<string, unknown>,
          displayBody: lines.join('\n'),
          title,
        }
      }
      return {
        structured: parsed as Record<string, unknown>,
        displayBody: text,
        title: undefined,
      }
    }

    case 'todo': {
      const todoData = todoOutputSchema.safeParse(parsed)
      if (todoData.success) {
        const { title, items, deadline, notes } = todoData.data
        const lines: string[] = []
        items.forEach(item => {
          const priority = item.priority === 'high' ? '❗' : item.priority === 'medium' ? '•' : '○'
          lines.push(`${priority} ${item.text}`)
        })
        if (deadline) {
          lines.push('')
          lines.push(`Deadline: ${deadline}`)
        }
        if (notes) {
          lines.push('')
          lines.push(notes)
        }
        return {
          structured: parsed as Record<string, unknown>,
          displayBody: lines.join('\n'),
          title,
        }
      }
      return {
        structured: parsed as Record<string, unknown>,
        displayBody: text,
        title: undefined,
      }
    }

    case 'question': {
      const questionData = questionOutputSchema.safeParse(parsed)
      if (questionData.success) {
        const { question, answer } = questionData.data
        return {
          structured: parsed as Record<string, unknown>,
          displayBody: answer || text,
          title: question,
        }
      }
      return {
        structured: parsed as Record<string, unknown>,
        displayBody: text,
        title: undefined,
      }
    }

    case 'note': {
      const noteData = noteOutputSchema.safeParse(parsed)
      if (noteData.success) {
        const { title, content, tags, category } = noteData.data
        const lines: string[] = []
        if (content) {
          lines.push(content)
        }
        if (tags.length > 0) {
          lines.push('')
          lines.push(`Tags: ${tags.join(', ')}`)
        }
        if (category) {
          lines.push(`Kategorie: ${category}`)
        }
        return {
          structured: parsed as Record<string, unknown>,
          displayBody: lines.join('\n') || text,
          title,
        }
      }
      return {
        structured: parsed as Record<string, unknown>,
        displayBody: text,
        title: undefined,
      }
    }

    case 'brainstorm': {
      const brainstormData = brainstormOutputSchema.safeParse(parsed)
      if (brainstormData.success) {
        const { topic, ideas } = brainstormData.data
        const lines: string[] = []
        ideas.forEach((idea, i) => {
          lines.push(`${i + 1}. ${idea.title}`)
          if (idea.description) lines.push(`   ${idea.description}`)
        })
        return {
          structured: parsed as Record<string, unknown>,
          displayBody: lines.join('\n'),
          title: topic,
        }
      }
      return {
        structured: parsed as Record<string, unknown>,
        displayBody: text,
        title: undefined,
      }
    }

    case 'summary': {
      const summaryData = summaryOutputSchema.safeParse(parsed)
      if (summaryData.success) {
        const { title, keyPoints, conclusion, fullSummary } = summaryData.data
        const lines: string[] = []
        keyPoints.forEach(point => lines.push(`• ${point}`))
        if (conclusion) {
          lines.push('')
          lines.push(`Fazit: ${conclusion}`)
        }
        if (fullSummary) {
          lines.push('')
          lines.push(fullSummary)
        }
        return {
          structured: parsed as Record<string, unknown>,
          displayBody: lines.join('\n'),
          title,
        }
      }
      return {
        structured: parsed as Record<string, unknown>,
        displayBody: text,
        title: undefined,
      }
    }

    case 'calendar': {
      const calendarData = calendarOutputSchema.safeParse(parsed)
      if (calendarData.success) {
        const { event, formatted } = calendarData.data
        const lines: string[] = []
        if (event?.title) lines.push(event.title)
        if (formatted?.dateDisplay) lines.push(`📅 ${formatted.dateDisplay}`)
        if (formatted?.timeDisplay) lines.push(`🕐 ${formatted.timeDisplay}`)
        if (event?.location) lines.push(`📍 ${event.location}`)
        if (event?.attendees && event.attendees.length > 0) {
          lines.push(`👥 ${event.attendees.join(', ')}`)
        }
        if (event?.notes) {
          lines.push('')
          lines.push(event.notes)
        }
        return {
          structured: parsed as Record<string, unknown>,
          displayBody: lines.join('\n'),
          title: event?.title || 'Neuer Termin',
        }
      }
      return {
        structured: parsed as Record<string, unknown>,
        displayBody: text,
        title: 'Neuer Termin',
      }
    }

    default: {
      const generalData = generalOutputSchema.safeParse(parsed)
      if (generalData.success) {
        const { title, content, summary } = generalData.data
        return {
          structured: parsed as Record<string, unknown>,
          displayBody: content || summary || text,
          title,
        }
      }
      return {
        structured: parsed as Record<string, unknown>,
        displayBody: text,
        title: undefined,
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
  const profileContext = options.profile
    ? buildFullProfileContext(options.profile, options.dailyQuestionsAnswers || [])
    : ''

  const systemPrompt = `Du bist ein Assistent der strukturierte Outputs auf Deutsch generiert.
${options.mode === 'work' ? 'Kontext: Beruflich - professioneller Ton.' : 'Kontext: Privat - freundlicher Ton.'}
${VARIANT_INSTRUCTIONS[options.variant]}${profileContext}

${getOutputTypePrompt(outputType)}

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

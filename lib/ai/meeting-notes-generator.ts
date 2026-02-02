/**
 * Meeting Notes Generator
 * Uses Gemini AI to generate structured meeting notes from transcripts
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { MeetingNotes, ActionItem, Topic } from '@/types/meeting'

export interface MeetingNotesInput {
  readonly transcript: string
  readonly title?: string
  readonly participants?: readonly string[]
  readonly duration?: number // in seconds
  readonly mode?: 'work' | 'private'
}

export interface GenerateMeetingNotesResult {
  readonly success: boolean
  readonly notes?: MeetingNotes
  readonly error?: string
}

const MEETING_NOTES_PROMPT = `Du bist ein professioneller Meeting-Protokollant. Analysiere das folgende Meeting-Transkript und extrahiere strukturierte Informationen.

WICHTIG: Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Erklärungen, kein Markdown, nur reines JSON.

Das JSON muss dieses exakte Format haben:
{
  "summary": "Eine prägnante Zusammenfassung des Meetings in 2-3 Sätzen",
  "keyPoints": ["Kernpunkt 1", "Kernpunkt 2", "..."],
  "decisions": ["Entscheidung 1", "Entscheidung 2", "..."],
  "actionItems": [
    {
      "id": "1",
      "task": "Beschreibung der Aufgabe",
      "owner": "Name oder null",
      "deadline": "Datum oder null",
      "priority": "high" | "medium" | "low",
      "completed": false
    }
  ],
  "topics": [
    {
      "id": "1",
      "title": "Thementitel",
      "summary": "Kurze Zusammenfassung des Themas",
      "duration": 0
    }
  ],
  "participants": ["Teilnehmer 1", "Teilnehmer 2"],
  "openQuestions": ["Offene Frage 1", "..."],
  "nextSteps": ["Nächster Schritt 1", "..."]
}

Regeln:
1. Extrahiere NUR Informationen die im Transkript vorhanden sind
2. Wenn etwas nicht klar ist, lasse das Array leer []
3. Schreibe auf Deutsch
4. Halte die Zusammenfassung prägnant (max 3 Sätze)
5. Priorisiere Aufgaben: "high" für dringend/wichtig, "medium" für normal, "low" für nice-to-have
6. Erkenne Teilnehmer aus dem Kontext (Namen, "ich", "wir", Sprecher-Labels)
7. Bei Entscheidungen achte auf Formulierungen wie "wir haben beschlossen", "es wurde entschieden", "machen wir so"
8. Bei offenen Fragen achte auf "müssen wir noch klären", "ist noch offen", Fragezeichen

TRANSKRIPT:
`

/**
 * Generate meeting notes from transcript using Gemini AI
 */
export async function generateMeetingNotes(
  input: MeetingNotesInput,
  apiKey?: string
): Promise<GenerateMeetingNotesResult> {
  try {
    const key = apiKey || process.env.GEMINI_API_KEY
    if (!key) {
      return {
        success: false,
        error: 'Gemini API key not configured',
      }
    }

    if (!input.transcript || input.transcript.trim().length < 50) {
      return {
        success: false,
        error: 'Transcript is too short to generate meaningful notes',
      }
    }

    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.3, // Lower temperature for more consistent structured output
        maxOutputTokens: 4096,
      },
    })

    // Build context
    let contextInfo = ''
    if (input.title) {
      contextInfo += `Meeting-Titel: ${input.title}\n`
    }
    if (input.participants && input.participants.length > 0) {
      contextInfo += `Bekannte Teilnehmer: ${input.participants.join(', ')}\n`
    }
    if (input.duration) {
      const minutes = Math.round(input.duration / 60)
      contextInfo += `Dauer: ${minutes} Minuten\n`
    }
    if (input.mode) {
      contextInfo += `Kontext: ${input.mode === 'work' ? 'Beruflich' : 'Privat'}\n`
    }

    const fullPrompt = MEETING_NOTES_PROMPT +
      (contextInfo ? `\nKONTEXT:\n${contextInfo}\n` : '') +
      input.transcript

    const result = await model.generateContent(fullPrompt)
    const response = result.response
    const text = response.text()

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Failed to extract JSON from response:', text)
      return {
        success: false,
        error: 'Failed to parse AI response',
      }
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Validate and transform to MeetingNotes format
    const notes: MeetingNotes = {
      summary: parsed.summary || '',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      actionItems: transformActionItems(parsed.actionItems),
      topics: transformTopics(parsed.topics),
      participants: Array.isArray(parsed.participants) ? parsed.participants : [],
      openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [],
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
    }

    return {
      success: true,
      notes,
    }
  } catch (error) {
    console.error('Error generating meeting notes:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}

/**
 * Transform action items from AI response to proper format
 */
function transformActionItems(items: unknown): readonly ActionItem[] {
  if (!Array.isArray(items)) return []

  return items.map((item, index) => ({
    id: item.id || crypto.randomUUID(),
    task: item.task || item.description || String(item),
    owner: item.owner || undefined,
    deadline: item.deadline || undefined,
    priority: validatePriority(item.priority),
    completed: item.completed || false,
  }))
}

/**
 * Validate priority value
 */
function validatePriority(priority: unknown): 'high' | 'medium' | 'low' {
  if (priority === 'high' || priority === 'medium' || priority === 'low') {
    return priority
  }
  return 'medium'
}

/**
 * Transform topics from AI response to proper format
 */
function transformTopics(topics: unknown): readonly Topic[] {
  if (!Array.isArray(topics)) return []

  return topics.map((topic, index) => ({
    id: topic.id || crypto.randomUUID(),
    title: topic.title || `Thema ${index + 1}`,
    summary: topic.summary || '',
    startTime: topic.startTime || 0,
    endTime: topic.endTime || 0,
  }))
}

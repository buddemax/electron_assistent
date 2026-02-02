/**
 * Meeting Notes Generator
 * Uses Gemini API to generate structured meeting notes from transcripts
 */

import type { MeetingNotes, ActionItem, Topic, TranscriptionSegment, Speaker } from '@/types/meeting'

export interface MeetingNotesInput {
  readonly meetingId: string
  readonly title: string
  readonly duration: number // in seconds
  readonly segments: readonly TranscriptionSegment[]
  readonly speakers: readonly Speaker[]
  readonly language: string
}

export interface MeetingNotesGeneratorEvents {
  onProgress: (stage: string, progress: number) => void
  onComplete: (notes: MeetingNotes) => void
  onError: (error: Error) => void
}

const MEETING_NOTES_PROMPT = `Du bist ein Experte für Meeting-Zusammenfassungen. Analysiere das folgende Transkript und erstelle strukturierte Meeting-Notizen.

TRANSKRIPT:
{transcript}

MEETING-INFORMATIONEN:
- Titel: {title}
- Dauer: {duration}
- Teilnehmer: {participants}
- Sprache: {language}

Erstelle eine JSON-Antwort mit folgendem Format:
{
  "summary": "Eine prägnante Zusammenfassung des Meetings in 2-3 Sätzen",
  "keyPoints": ["Wichtiger Punkt 1", "Wichtiger Punkt 2", ...],
  "decisions": ["Entscheidung 1", "Entscheidung 2", ...],
  "actionItems": [
    {
      "task": "Aufgabenbeschreibung",
      "owner": "Name der verantwortlichen Person (falls genannt)",
      "deadline": "Termin (falls genannt)",
      "priority": "high" | "medium" | "low"
    }
  ],
  "topics": [
    {
      "title": "Thementitel",
      "summary": "Kurze Zusammenfassung des Themas",
      "startTimeMinutes": 0,
      "endTimeMinutes": 5
    }
  ],
  "participants": ["Teilnehmer 1", "Teilnehmer 2", ...],
  "openQuestions": ["Offene Frage 1", "Offene Frage 2", ...],
  "nextSteps": ["Nächster Schritt 1", "Nächster Schritt 2", ...]
}

WICHTIGE HINWEISE:
- Extrahiere nur tatsächlich besprochene Punkte, erfinde nichts
- Markiere Action Items nur wenn sie explizit genannt wurden
- Schätze Prioritäten basierend auf dem Kontext
- Wenn keine Entscheidungen getroffen wurden, lasse das Array leer
- Antworte NUR mit dem JSON, ohne zusätzlichen Text`

export async function generateMeetingNotes(
  input: MeetingNotesInput,
  events: MeetingNotesGeneratorEvents
): Promise<MeetingNotes> {
  events.onProgress('Transkript wird vorbereitet...', 10)

  // Build full transcript text
  const transcriptText = buildTranscriptText(input.segments, input.speakers)

  // Format duration
  const durationMinutes = Math.floor(input.duration / 60)
  const durationFormatted = `${durationMinutes} Minuten`

  // Get participant names
  const participants = input.speakers
    .map((s) => s.name || s.label)
    .join(', ')

  events.onProgress('Notizen werden generiert...', 30)

  // Build prompt
  const prompt = MEETING_NOTES_PROMPT
    .replace('{transcript}', transcriptText)
    .replace('{title}', input.title)
    .replace('{duration}', durationFormatted)
    .replace('{participants}', participants || 'Nicht identifiziert')
    .replace('{language}', input.language === 'de' ? 'Deutsch' : 'Englisch')

  try {
    // Call Gemini API
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        mode: 'work',
        context: {
          type: 'meeting-notes',
          meetingId: input.meetingId,
        },
      }),
    })

    events.onProgress('Antwort wird verarbeitet...', 70)

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const generatedText = data.output || data.text || ''

    events.onProgress('Notizen werden formatiert...', 90)

    // Parse JSON response
    const notes = parseNotesResponse(generatedText, input)

    events.onProgress('Fertig!', 100)
    events.onComplete(notes)

    return notes
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    events.onError(err)
    throw err
  }
}

function buildTranscriptText(
  segments: readonly TranscriptionSegment[],
  speakers: readonly Speaker[]
): string {
  const getSpeakerLabel = (speakerId?: string): string => {
    if (!speakerId) return ''
    const speaker = speakers.find((s) => s.id === speakerId)
    return speaker ? `[${speaker.name || speaker.label}]: ` : ''
  }

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return segments
    .map((seg) => {
      const time = formatTime(seg.startTime)
      const speaker = getSpeakerLabel(seg.speakerId)
      return `[${time}] ${speaker}${seg.text}`
    })
    .join('\n')
}

function parseNotesResponse(text: string, input: MeetingNotesInput): MeetingNotes {
  // Extract JSON from response (handle markdown code blocks)
  let jsonText = text
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(jsonText)

    // Map to MeetingNotes structure
    const actionItems: ActionItem[] = (parsed.actionItems || []).map(
      (item: { task: string; owner?: string; deadline?: string; priority?: string }, index: number) => ({
        id: crypto.randomUUID(),
        task: item.task,
        owner: item.owner,
        deadline: item.deadline,
        priority: (item.priority as 'high' | 'medium' | 'low') || 'medium',
        completed: false,
      })
    )

    const topics: Topic[] = (parsed.topics || []).map(
      (topic: { title: string; summary: string; startTimeMinutes?: number; endTimeMinutes?: number }, index: number) => ({
        id: crypto.randomUUID(),
        title: topic.title,
        summary: topic.summary,
        startTime: (topic.startTimeMinutes || 0) * 60 * 1000,
        endTime: (topic.endTimeMinutes || 0) * 60 * 1000,
      })
    )

    return {
      summary: parsed.summary || 'Keine Zusammenfassung verfügbar.',
      keyPoints: parsed.keyPoints || [],
      decisions: parsed.decisions || [],
      actionItems,
      topics,
      participants: parsed.participants || input.speakers.map((s) => s.name || s.label),
      openQuestions: parsed.openQuestions || [],
      nextSteps: parsed.nextSteps || [],
    }
  } catch (parseError) {
    console.error('Failed to parse meeting notes JSON:', parseError)

    // Return basic notes with raw text as summary
    return {
      summary: text.slice(0, 500),
      keyPoints: [],
      decisions: [],
      actionItems: [],
      topics: [],
      participants: input.speakers.map((s) => s.name || s.label),
      openQuestions: [],
      nextSteps: [],
    }
  }
}

/**
 * Export meeting notes to different formats
 */
export function exportNotesToMarkdown(notes: MeetingNotes, title: string): string {
  let md = `# ${title}\n\n`

  md += `## Zusammenfassung\n${notes.summary}\n\n`

  if (notes.keyPoints.length > 0) {
    md += `## Wichtige Punkte\n`
    notes.keyPoints.forEach((point) => {
      md += `- ${point}\n`
    })
    md += '\n'
  }

  if (notes.decisions.length > 0) {
    md += `## Entscheidungen\n`
    notes.decisions.forEach((decision) => {
      md += `- ${decision}\n`
    })
    md += '\n'
  }

  if (notes.actionItems.length > 0) {
    md += `## Aufgaben\n`
    notes.actionItems.forEach((item) => {
      const priority = item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🟢'
      const owner = item.owner ? ` (${item.owner})` : ''
      const deadline = item.deadline ? ` - bis ${item.deadline}` : ''
      md += `- [ ] ${priority} ${item.task}${owner}${deadline}\n`
    })
    md += '\n'
  }

  if (notes.topics.length > 0) {
    md += `## Besprochene Themen\n`
    notes.topics.forEach((topic) => {
      md += `### ${topic.title}\n${topic.summary}\n\n`
    })
  }

  if (notes.openQuestions.length > 0) {
    md += `## Offene Fragen\n`
    notes.openQuestions.forEach((question) => {
      md += `- ${question}\n`
    })
    md += '\n'
  }

  if (notes.nextSteps.length > 0) {
    md += `## Nächste Schritte\n`
    notes.nextSteps.forEach((step) => {
      md += `1. ${step}\n`
    })
    md += '\n'
  }

  if (notes.participants.length > 0) {
    md += `---\n**Teilnehmer:** ${notes.participants.join(', ')}\n`
  }

  return md
}

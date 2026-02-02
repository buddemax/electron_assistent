/**
 * Document context extraction using Gemini AI
 */

import { getGeminiClient } from '@/lib/ai/gemini-client'
import type {
  DocumentContext,
  DocumentFileType,
  DocumentSummary,
  DocumentTopic,
  DocumentEntity,
  KeyFact,
  EntityRelationship,
  ActionItem,
  DocumentDecision,
  DocumentDeadline,
} from '@/types/document'

const DOCUMENT_CONTEXT_EXTRACTION_PROMPT = `
Analysiere das folgende Dokument UMFASSEND und extrahiere ALLE relevanten Informationen.

WICHTIG: Antworte NUR mit gültigem JSON im folgenden Format:

{
  "summary": {
    "brief": "1-2 Sätze Kernaussage des Dokuments",
    "standard": "Ein Absatz (3-5 Sätze) mit den wichtigsten Punkten",
    "comprehensive": "Ausführliche Zusammenfassung (mehrere Absätze) mit allen wichtigen Details und Struktur"
  },
  "topics": [
    {
      "name": "Hauptthema",
      "relevance": 0.95,
      "subtopics": ["Unterthema 1", "Unterthema 2"],
      "relatedKeywords": ["keyword1", "keyword2", "keyword3"]
    }
  ],
  "entities": [
    {
      "text": "Name der Person/Firma/Projekt/etc",
      "type": "person|project|technology|company|deadline|decision|fact|preference",
      "mentions": 3,
      "context": "Umgebender Text der die Entität beschreibt oder verwendet",
      "confidence": 0.9
    }
  ],
  "keyFacts": [
    {
      "fact": "Wichtige Aussage, Zahl oder Information",
      "category": "statistic|claim|definition|requirement|other",
      "source": "Wo im Dokument gefunden (Seite/Abschnitt/Kontext)",
      "confidence": 0.85
    }
  ],
  "relationships": [
    {
      "entity1": "Person/Firma A",
      "entity2": "Person/Firma B",
      "relationshipType": "works_for|manages|owns|partners_with|related_to|depends_on",
      "description": "Beschreibung der Beziehung"
    }
  ],
  "actionItems": [
    {
      "task": "Was zu tun ist (klar formuliert)",
      "assignee": "Verantwortliche Person (null wenn unbekannt)",
      "deadline": "Frist (null wenn unbekannt)",
      "priority": "high|medium|low",
      "context": "Kontext aus dem Dokument warum diese Aufgabe wichtig ist"
    }
  ],
  "decisions": [
    {
      "decision": "Was entschieden wurde",
      "rationale": "Begründung (null wenn nicht angegeben)",
      "stakeholders": ["Beteiligte Personen/Gruppen"],
      "date": "Datum der Entscheidung (null wenn unbekannt)"
    }
  ],
  "deadlines": [
    {
      "description": "Was bis wann erledigt sein muss",
      "date": "Konkretes Datum oder Zeitraum",
      "associatedTask": "Zugehörige Aufgabe falls vorhanden"
    }
  ],
  "confidence": 0.85
}

EXTRAKTIONS-RICHTLINIEN:
- Sei GRÜNDLICH: Extrahiere ALLE relevanten Informationen, nicht nur die offensichtlichsten
- Sei PRÄZISE: Nur Fakten aus dem Dokument, keine Annahmen oder Interpretationen
- Sei STRUKTURIERT: Kategorisiere korrekt nach den vorgegebenen Typen
- Sei DETAILLIERT: Bei Zusammenfassungen lieber zu viel als zu wenig
- Bei Unsicherheit: Niedrigere Konfidenz angeben, aber trotzdem extrahieren
- Behalte wichtige Zahlen, Daten, Namen und Fachbegriffe bei
- Erkenne auch implizite Beziehungen zwischen Entitäten
- Extrahiere ALLE Personen, Firmen, Projekte, Technologien die erwähnt werden
- Achte besonders auf Zahlen, Prozentsätze, Geldbeträge, Zeitangaben

DOKUMENTTYP-SPEZIFISCHE HINWEISE:
- Bei Präsentationen: Fokus auf Kernbotschaften pro Folie, Hauptargumente
- Bei Berichten: Fokus auf Ergebnisse, Empfehlungen, Kennzahlen
- Bei Verträgen: Fokus auf Pflichten, Fristen, Parteien, Konditionen
- Bei E-Mails/Protokollen: Fokus auf Action Items, Entscheidungen, Verantwortlichkeiten
- Bei technischen Docs: Fokus auf Anforderungen, Spezifikationen, Abhängigkeiten

Dokumentname: {FILENAME}
Dokumenttyp: {FILETYPE}

Dokument-Inhalt:
"""
{DOCUMENT_CONTENT}
"""
`

interface RawExtractedContext {
  summary: {
    brief: string
    standard: string
    comprehensive: string
  }
  topics: Array<{
    name: string
    relevance: number
    subtopics: string[]
    relatedKeywords: string[]
  }>
  entities: Array<{
    text: string
    type: string
    mentions: number
    context: string
    confidence: number
  }>
  keyFacts: Array<{
    fact: string
    category: string
    source: string
    confidence: number
  }>
  relationships: Array<{
    entity1: string
    entity2: string
    relationshipType: string
    description: string
  }>
  actionItems: Array<{
    task: string
    assignee: string | null
    deadline: string | null
    priority: string
    context: string
  }>
  decisions: Array<{
    decision: string
    rationale: string | null
    stakeholders: string[]
    date: string | null
  }>
  deadlines: Array<{
    description: string
    date: string
    associatedTask: string | null
  }>
  confidence: number
}

export async function extractDocumentContext(
  text: string,
  filename: string,
  fileType: DocumentFileType,
  apiKey: string
): Promise<DocumentContext> {
  // Use higher token limit for document analysis (8192 tokens)
  const model = getGeminiClient(apiKey, { maxOutputTokens: 8192, temperature: 0.3 })

  // Prepare the prompt
  const prompt = DOCUMENT_CONTEXT_EXTRACTION_PROMPT
    .replace('{FILENAME}', filename)
    .replace('{FILETYPE}', fileType.toUpperCase())
    .replace('{DOCUMENT_CONTENT}', truncateText(text, 100000))

  let responseText = ''

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
    })

    responseText = result.response.text().trim()
  } catch (apiError) {
    // Log the API error for debugging
    const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error'
    console.error('[Context Extractor] Gemini API error:', errorMessage)

    // Return error context
    return createErrorContext(`API Fehler: ${errorMessage}`)
  }

  // Log response for debugging (first 500 chars)
  console.error('[Context Extractor] Response preview:', responseText.slice(0, 500))

  const parsed = parseContextResponse(responseText)

  const documentId = crypto.randomUUID()

  return {
    id: crypto.randomUUID(),
    documentId,
    summary: parsed.summary as DocumentSummary,
    topics: parsed.topics as readonly DocumentTopic[],
    entities: mapEntities(parsed.entities),
    keyFacts: mapKeyFacts(parsed.keyFacts),
    relationships: parsed.relationships as readonly EntityRelationship[],
    actionItems: mapActionItems(parsed.actionItems),
    decisions: parsed.decisions as readonly DocumentDecision[],
    deadlines: parsed.deadlines as readonly DocumentDeadline[],
    confidence: parsed.confidence,
    processingTimestamp: new Date(),
    geminiModelUsed: 'gemini-2.0-flash',
  }
}

function createErrorContext(errorMessage: string): DocumentContext {
  return {
    id: crypto.randomUUID(),
    documentId: crypto.randomUUID(),
    summary: {
      brief: 'Fehler bei der Analyse',
      standard: `Das Dokument konnte nicht analysiert werden: ${errorMessage}`,
      comprehensive: `Bei der Analyse des Dokuments ist ein Fehler aufgetreten.\n\nFehlerdetails: ${errorMessage}`,
    },
    topics: [],
    entities: [],
    keyFacts: [],
    relationships: [],
    actionItems: [],
    decisions: [],
    deadlines: [],
    confidence: 0,
    processingTimestamp: new Date(),
    geminiModelUsed: 'gemini-2.0-flash',
  }
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text

  // Try to truncate at a sentence boundary
  const truncated = text.slice(0, maxChars)
  const lastPeriod = truncated.lastIndexOf('.')
  const lastNewline = truncated.lastIndexOf('\n')
  const cutoff = Math.max(lastPeriod, lastNewline, maxChars - 100)

  return truncated.slice(0, cutoff) + '\n\n[... Dokument gekürzt ...]'
}

function parseContextResponse(response: string): RawExtractedContext {
  // Clean up potential markdown code blocks
  let jsonText = response.trim()

  // Remove markdown code block markers
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7)
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3)
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3)
  }
  jsonText = jsonText.trim()

  // Try direct parsing first
  try {
    return JSON.parse(jsonText)
  } catch (e1) {
    console.error('[Context Extractor] Direct JSON parse failed, trying to extract JSON object...')

    // Try to find JSON object in the response (Gemini might add extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch (e2) {
        console.error('[Context Extractor] JSON extraction also failed:', e2)
      }
    }

    // Log what we received for debugging
    console.error('[Context Extractor] Could not parse response. First 1000 chars:', response.slice(0, 1000))

    // Return empty context on parse error
    return {
      summary: {
        brief: 'Fehler bei der Analyse',
        standard: 'Das Dokument konnte nicht analysiert werden. Die KI-Antwort war ungültig.',
        comprehensive: 'Bei der Analyse des Dokuments ist ein Fehler aufgetreten. Die Antwort von Gemini konnte nicht verarbeitet werden.',
      },
      topics: [],
      entities: [],
      keyFacts: [],
      relationships: [],
      actionItems: [],
      decisions: [],
      deadlines: [],
      confidence: 0,
    }
  }
}

function mapEntities(
  entities: RawExtractedContext['entities']
): readonly DocumentEntity[] {
  const validTypes = [
    'person',
    'project',
    'technology',
    'company',
    'deadline',
    'decision',
    'fact',
    'preference',
  ]

  return entities.map((e) => ({
    text: e.text,
    type: validTypes.includes(e.type) ? (e.type as DocumentEntity['type']) : 'fact',
    mentions: e.mentions,
    context: e.context,
    confidence: e.confidence,
  }))
}

function mapKeyFacts(facts: RawExtractedContext['keyFacts']): readonly KeyFact[] {
  const validCategories = ['statistic', 'claim', 'definition', 'requirement', 'other']

  return facts.map((f) => ({
    fact: f.fact,
    category: validCategories.includes(f.category)
      ? (f.category as KeyFact['category'])
      : 'other',
    source: f.source,
    confidence: f.confidence,
  }))
}

function mapActionItems(
  items: RawExtractedContext['actionItems']
): readonly ActionItem[] {
  const validPriorities = ['high', 'medium', 'low']

  return items.map((item) => ({
    task: item.task,
    assignee: item.assignee,
    deadline: item.deadline,
    priority: validPriorities.includes(item.priority)
      ? (item.priority as ActionItem['priority'])
      : 'medium',
    context: item.context,
  }))
}

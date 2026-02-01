import { getGeminiClient } from '@/lib/ai/gemini-client'
import type { EntityType, ExtractedEntity } from '@/types/knowledge'
import type { Mode } from '@/types/output'

export interface ExtractionResult {
  entities: ExtractedEntity[]
  shouldStore: boolean
  storeReason: string
  suggestedTags: string[]
}

const ENTITY_EXTRACTION_PROMPT = `Analysiere den folgenden Text und extrahiere relevante Entitäten.

WICHTIG: Antworte NUR mit gültigem JSON in exakt diesem Format:
{
  "entities": [
    {
      "text": "Name oder Begriff",
      "type": "person|project|technology|company|deadline|decision|fact|preference",
      "confidence": 0.0-1.0
    }
  ],
  "shouldStore": true/false,
  "storeReason": "Warum speichern oder nicht",
  "suggestedTags": ["tag1", "tag2"]
}

Entitäts-Typen:
- person: Namen von Personen (z.B. "Frau Weber", "Max Müller")
- project: Projektnamen (z.B. "Projekt Alpha", "SAP Migration")
- technology: Technologien/Tools (z.B. "SAP S4HANA", "React", "Python")
- company: Firmen/Organisationen (z.B. "Google", "Acme GmbH")
- deadline: Termine/Fristen (z.B. "nächste Woche", "15. März", "Q2 2025")
- decision: Entscheidungen (z.B. "Wir haben beschlossen...", "Entscheidung für...")
- fact: Wichtige Fakten (z.B. "Budget: 80.000€", "Team-Größe: 5 Personen")
- preference: Präferenzen (z.B. "Ich bevorzuge...", "Am liebsten...")

Speicher-Kriterien (shouldStore = true):
- Enthält Projektnamen, Personen oder wichtige Fakten
- Enthält Entscheidungen oder Deadlines
- Hat geschäftlichen/persönlichen Wert für später

NICHT speichern (shouldStore = false):
- Smalltalk ohne Inhalt ("Wie geht's?", "Schönes Wetter")
- Einmal-Anfragen ohne Kontext-Wert
- Reine Befehle ohne Informationsgehalt

Text: """
{TEXT}
"""

Kontext: {MODE}
`

/**
 * Extract entities from transcribed text using Gemini
 */
export async function extractEntities(
  text: string,
  mode: Mode,
  apiKey?: string
): Promise<ExtractionResult> {
  const key = apiKey || process.env.GEMINI_API_KEY
  if (!key) {
    throw new Error('GEMINI_API_KEY is required for entity extraction')
  }

  const model = getGeminiClient(key)

  const modeContext = mode === 'work'
    ? 'Beruflich - achte besonders auf Projekte, Kollegen, Termine'
    : 'Privat - achte auf persönliche Kontakte, Hobbys, persönliche Termine'

  const prompt = ENTITY_EXTRACTION_PROMPT
    .replace('{TEXT}', text)
    .replace('{MODE}', modeContext)

  try {
    const result = await model.generateContent(prompt)
    const responseText = result.response.text().trim()

    // Parse JSON response
    let parsed: {
      entities?: Array<{ text: string; type: string; confidence: number }>
      shouldStore?: boolean
      storeReason?: string
      suggestedTags?: string[]
    }

    try {
      // Clean up potential markdown code blocks
      let jsonText = responseText
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
      // If JSON parsing fails, return empty result
      return {
        entities: [],
        shouldStore: false,
        storeReason: 'Konnte keine Entitäten extrahieren',
        suggestedTags: [],
      }
    }

    // Validate and map entities
    const validTypes: EntityType[] = [
      'person', 'project', 'technology', 'company',
      'deadline', 'decision', 'fact', 'preference', 'unknown'
    ]

    const entities: ExtractedEntity[] = (parsed.entities || [])
      .filter(e => e.text && e.type)
      .map((e, index) => ({
        text: e.text,
        type: validTypes.includes(e.type as EntityType) ? e.type as EntityType : 'unknown',
        confidence: Math.min(1, Math.max(0, e.confidence || 0.5)),
        startIndex: text.indexOf(e.text),
        endIndex: text.indexOf(e.text) + e.text.length,
      }))

    return {
      entities,
      shouldStore: parsed.shouldStore ?? entities.length > 0,
      storeReason: parsed.storeReason || 'Enthält relevante Informationen',
      suggestedTags: parsed.suggestedTags || [],
    }
  } catch (error) {
    console.error('Entity extraction failed:', error)
    return {
      entities: [],
      shouldStore: false,
      storeReason: 'Fehler bei der Extraktion',
      suggestedTags: [],
    }
  }
}

/**
 * Determine the primary entity type for a knowledge entry
 */
export function getPrimaryEntityType(entities: ExtractedEntity[]): EntityType | undefined {
  if (entities.length === 0) return undefined

  // Priority order for entity types
  const priority: EntityType[] = [
    'project', 'person', 'decision', 'deadline',
    'company', 'technology', 'fact', 'preference', 'unknown'
  ]

  // Find highest priority type with good confidence
  for (const type of priority) {
    const entity = entities.find(e => e.type === type && e.confidence >= 0.6)
    if (entity) return type
  }

  // Fallback to most confident entity
  const sorted = [...entities].sort((a, b) => b.confidence - a.confidence)
  return sorted[0]?.type
}

/**
 * Create a content summary for storage
 */
export function createContentSummary(text: string, entities: ExtractedEntity[]): string {
  // If text is short, use it directly
  if (text.length <= 200) return text

  // Otherwise, create a summary based on entities
  const entityTexts = entities
    .filter(e => e.confidence >= 0.5)
    .map(e => e.text)
    .slice(0, 5)

  if (entityTexts.length > 0) {
    return `${text.slice(0, 100)}... [${entityTexts.join(', ')}]`
  }

  return text.slice(0, 200) + '...'
}

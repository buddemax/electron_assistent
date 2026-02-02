import { getGeminiClient } from '@/lib/ai/gemini-client'
import type { EntityType, ExtractedEntity } from '@/types/knowledge'
import type { Mode } from '@/types/output'

export interface ExtractionResult {
  entities: ExtractedEntity[]
  shouldStore: boolean
  storeReason: string
  suggestedTags: string[]
  /** Extracted facts that should be stored separately */
  extractedFacts: ExtractedFact[]
}

export interface ExtractedFact {
  /** The fact content to store */
  content: string
  /** Entity type this fact belongs to */
  entityType: EntityType
  /** Related entity name (e.g., project name, person name) */
  relatedEntity: string
  /** Suggested tags for this fact */
  tags: string[]
  /** Confidence score */
  confidence: number
}

/**
 * Prompt for extracting valuable facts from ANY text (including questions/requests)
 */
const FACT_EXTRACTION_PROMPT = `Du extrahierst NEUE INFORMATIONEN aus Texten - auch wenn der Text eine Anfrage ist!

WICHTIG: Antworte NUR mit gültigem JSON:
{
  "facts": [
    {
      "content": "Der extrahierte Fakt als vollständiger Satz",
      "entityType": "project|person|deadline|company|technology|decision|fact",
      "relatedEntity": "Hauptentität (Projektname, Personenname, etc.)",
      "tags": ["tag1", "tag2"],
      "confidence": 0.8
    }
  ]
}

=== WAS DU EXTRAHIEREN SOLLST ===

PROJEKTE:
- Projektnamen: "SAP S4HANA Projekt", "Blue-Arm Projekt"
- Projektstarts: "Projekt startet am 16. Februar", "beginnt nächste Woche"
- Projektkunden: "Projekt für Land Sachsen", "Kunde ist Brandenburg"

TERMINE/DEADLINES:
- Konkrete Daten: "am 16. Februar 2026", "in zwei Wochen"
- Meilensteine: "Abnahme bis März", "Go-Live im Q2"

PERSONEN:
- Namen mit Kontext: "Herr Peters ist Projektleiter", "Mail an Frau Weber"
- Rollen: "Ansprechpartner ist Thomas Eichler"

=== BEISPIELE ===

Input: "Schreibe eine E-Mail dass das SAP S4HANA Projekt für Land Sachsen am 16. Februar startet"
Output: {"facts": [{"content": "SAP S4HANA Projekt für Land Sachsen startet am 16. Februar 2026", "entityType": "project", "relatedEntity": "SAP S4HANA", "tags": ["SAP", "Sachsen", "Projektstart", "Februar 2026"], "confidence": 0.9}]}

Input: "Erstelle eine Notiz zum Meeting mit Herrn Weber am Donnerstag"
Output: {"facts": [{"content": "Meeting mit Herrn Weber am Donnerstag", "entityType": "deadline", "relatedEntity": "Herr Weber", "tags": ["Meeting", "Weber"], "confidence": 0.8}]}

Input: "Was ist das SAP Projekt?"
Output: {"facts": []}

=== DEIN TEXT ===

Text: """
{TEXT}
"""

Kontext: {MODE}

Extrahiere jetzt alle Fakten. Wenn keine neuen Informationen vorhanden sind, gib {"facts": []} zurück.`

const ENTITY_EXTRACTION_PROMPT = `Analysiere den folgenden Text und entscheide, ob er WERTVOLLE INFORMATIONEN enthält, die gespeichert werden sollten.

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
- person: Namen von Personen mit neuen Infos (z.B. "Max hat am 5.3. Geburtstag")
- project: Projektdetails (z.B. "SAP Migration dauert 2 Jahre", "Projektbudget 80.000€")
- technology: Technologie-Entscheidungen (z.B. "Wir nutzen SAP BTP mit SuccessFactors")
- company: Firmeninfos (z.B. "Kunde ist Land Brandenburg")
- deadline: Konkrete Termine (z.B. "Abnahme bis 22.01.2026")
- decision: Entscheidungen (z.B. "Wir haben beschlossen, React zu nutzen")
- fact: Wichtige Fakten (z.B. "Team besteht aus 5 Personen")
- preference: Präferenzen (z.B. "Ich bevorzuge formelle E-Mails")

=== KRITISCH: SPEICHER-REGELN ===

NUR SPEICHERN (shouldStore = true) wenn der Text:
- NEUE FAKTEN mitteilt ("Merke dir...", "Speichere...", "Das Projekt hat...")
- KONKRETE DETAILS enthält (Daten, Namen, Zahlen, Beschreibungen)
- WISSEN für später bereitstellt
- Explizit zum Speichern auffordert ("Bitte merke dir...", "Speichere...")

NIEMALS SPEICHERN (shouldStore = false) bei:
- FRAGEN: "Was ist...?", "Wer hat...?", "Wie funktioniert...?", "Kannst du mir sagen...?"
- ANFRAGEN: "Schreibe mir...", "Erstelle...", "Informiere mich über...", "Gib mir..."
- RÜCKFRAGEN: "Wer war dabei?", "Gibt es noch mehr?", "Was genau?"
- BEFEHLE ohne Infos: "Bitte informiere mich", "Erkläre mir"
- WIEDERHOLUNGEN von bereits bekannten Themen

BEISPIELE:

❌ NICHT speichern:
- "Was genau machen wir beim SAP Projekt?" → Frage, keine neue Info
- "Kannst du mir eine E-Mail schreiben?" → Anfrage, keine neue Info
- "Wer war am Projekt beteiligt?" → Frage, keine neue Info
- "Informiere mich über das Blue-Arm-Projekt" → Anfrage, keine neue Info

✅ Speichern:
- "Bitte merke dir, dass Dana am 9.4. Geburtstag hat" → Neue Fakten
- "Wir haben ein SAP S4HANA Projekt beim Land Brandenburg" → Projektdetails
- "Das Team besteht aus Max, Anna und Thomas" → Konkrete Info
- "Die Deadline ist der 15. März 2026" → Wichtiger Termin

Text: """
{TEXT}
"""

Kontext: {MODE}
`

/**
 * Check if text is a question or request (not storable)
 */
function isQuestionOrRequest(text: string): boolean {
  const trimmed = text.trim().toLowerCase()

  // Question patterns
  const questionPatterns = [
    /^was\s+(ist|sind|war|waren|macht|machen|genau|weiß)/i,
    /^wer\s+(ist|sind|war|waren|hat|haben)/i,
    /^wie\s+(ist|sind|war|funktioniert|geht|viele?)/i,
    /^wo\s+(ist|sind|war|liegt)/i,
    /^wann\s+(ist|war|wird|hat)/i,
    /^warum\s+(ist|war|hat|haben)/i,
    /^welche[rs]?\s/i,
    /^gibt\s+es/i,
    /\?$/,  // Ends with question mark
  ]

  // Request patterns (asking for output, not providing info)
  const requestPatterns = [
    /^(bitte\s+)?(schreib|erstell|generier|mach|gib|zeig|informier|erkläre?|nenn|benenn|list)/i,
    /^kannst\s+du\s+(mir\s+)?(schreib|erstell|sag|gib|zeig|informier|erkläre?)/i,
    /^ich\s+(möchte|will|brauche)\s+(eine?n?\s+)?(e-?mail|nachricht|liste|übersicht)/i,
    /^(bitte\s+)?informiere?\s+mich/i,
  ]

  // Check for question patterns
  if (questionPatterns.some(p => p.test(trimmed))) {
    return true
  }

  // Check for request patterns
  if (requestPatterns.some(p => p.test(trimmed))) {
    // Exception: if it contains "merke dir", "speichere", it's a storage request
    if (/merk(e|t)?\s+(dir|euch)|speicher/i.test(trimmed)) {
      return false
    }
    return true
  }

  return false
}

/**
 * Check if text contains explicit storage request
 */
function isExplicitStorageRequest(text: string): boolean {
  const patterns = [
    /merk(e|t)?\s+(dir|euch)/i,
    /speicher(e|t|n)?/i,
    /notier(e|t)?/i,
    /bitte\s+(be)?halt(e|en)?/i,
  ]
  return patterns.some(p => p.test(text))
}

/**
 * Extract facts from text (works for any text including questions/requests)
 */
async function extractFacts(
  text: string,
  mode: Mode,
  apiKey: string
): Promise<ExtractedFact[]> {
  // Skip very short texts (less than 20 chars) - unlikely to have valuable facts
  if (text.trim().length < 20) {
    return []
  }

  const model = getGeminiClient(apiKey)

  const modeContext = mode === 'work'
    ? 'Beruflich - achte besonders auf Projekte, Kollegen, Termine'
    : 'Privat - achte auf persönliche Kontakte, Hobbys, persönliche Termine'

  const prompt = FACT_EXTRACTION_PROMPT
    .replace('{TEXT}', text)
    .replace('{MODE}', modeContext)

  try {
    const result = await model.generateContent(prompt)
    const responseText = result.response.text().trim()

    // Parse JSON response - handle various formats
    let jsonText = responseText

    // Remove markdown code blocks
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7)
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3)
    }

    // Try to find JSON object if there's extra text
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonText = jsonMatch[0]
    }

    const parsed = JSON.parse(jsonText.trim()) as {
      facts?: Array<{
        content: string
        entityType: string
        relatedEntity: string
        tags: string[]
        confidence: number
      }>
    }

    const validTypes: EntityType[] = [
      'person', 'project', 'technology', 'company',
      'deadline', 'decision', 'fact', 'preference', 'unknown'
    ]

    // Lower threshold to 0.4 to catch more facts - we want to be inclusive
    const facts = (parsed.facts || [])
      .filter(f => f.content && f.content.length > 5)
      .map(f => ({
        content: f.content,
        entityType: validTypes.includes(f.entityType as EntityType)
          ? f.entityType as EntityType
          : 'fact',
        relatedEntity: f.relatedEntity || 'Unbekannt',
        tags: f.tags || [],
        confidence: Math.min(1, Math.max(0, f.confidence || 0.7)),
      }))

    return facts
  } catch (error) {
    // Log error for debugging but don't fail
    console.warn('Fact extraction parsing failed:', error)
    return []
  }
}

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

  const isQuestion = isQuestionOrRequest(text)
  const isStorageRequest = isExplicitStorageRequest(text)

  // ALWAYS try to extract facts first - even from requests
  const extractedFacts = await extractFacts(text, mode, key)

  // For questions/requests: don't store the full message, just the facts
  if (isQuestion && !isStorageRequest) {
    return {
      entities: [],
      shouldStore: false,
      storeReason: extractedFacts.length > 0
        ? `${extractedFacts.length} Fakt(en) extrahiert`
        : 'Frage oder Anfrage - keine neuen Informationen',
      suggestedTags: [],
      extractedFacts,
    }
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
        extractedFacts: [],
      }
    }

    // Validate and map entities
    const validTypes: EntityType[] = [
      'person', 'project', 'technology', 'company',
      'deadline', 'decision', 'fact', 'preference', 'unknown'
    ]

    const entities: ExtractedEntity[] = (parsed.entities || [])
      .filter(e => e.text && e.type)
      .map((e) => ({
        text: e.text,
        type: validTypes.includes(e.type as EntityType) ? e.type as EntityType : 'unknown',
        confidence: Math.min(1, Math.max(0, e.confidence || 0.5)),
        startIndex: text.indexOf(e.text),
        endIndex: text.indexOf(e.text) + e.text.length,
      }))

    // Facts were already extracted at the start of the function
    return {
      entities,
      shouldStore: parsed.shouldStore ?? entities.length > 0,
      storeReason: parsed.storeReason || 'Enthält relevante Informationen',
      suggestedTags: parsed.suggestedTags || [],
      extractedFacts, // Use the facts extracted at the beginning
    }
  } catch (error) {
    console.error('Entity extraction failed:', error)
    return {
      entities: [],
      shouldStore: false,
      storeReason: 'Fehler bei der Extraktion',
      suggestedTags: [],
      extractedFacts: [],
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

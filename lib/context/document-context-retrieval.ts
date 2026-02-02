/**
 * Document context retrieval for question answering
 * Searches through uploaded documents to find relevant information
 */

import type { DocumentEntry, DocumentContext } from '@/types/document'
import type { KnowledgeReference } from '@/types/knowledge'
import type { Mode } from '@/types/output'

export interface DocumentRetrievalOptions {
  readonly query: string
  readonly mode: Mode
  readonly limit?: number
  readonly minRelevance?: number
}

export interface DocumentRetrievalResult {
  readonly references: readonly KnowledgeReference[]
  readonly matchedDocuments: readonly string[]
  readonly totalMatches: number
}

/**
 * Extract keywords from a query for matching
 * Preserves question words for context-aware snippet building
 */
function extractKeywords(text: string): string[] {
  // Question words to KEEP for context detection (not for matching, but for snippet building)
  const questionWords = new Set(['wer', 'was', 'wie', 'wo', 'wann', 'warum', 'welche', 'welcher'])

  const stopWords = new Set([
    'der', 'die', 'das', 'den', 'dem', 'des',
    'ein', 'eine', 'einer', 'einem', 'einen',
    'und', 'oder', 'aber', 'wenn', 'weil', 'dass',
    'ist', 'sind', 'war', 'waren', 'wird', 'werden',
    'hat', 'haben', 'hatte', 'hatten',
    'mit', 'von', 'zu', 'bei', 'für', 'auf', 'in', 'an',
    'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr',
    'mein', 'dein', 'sein', 'ihr', 'unser', 'euer',
    'nicht', 'auch', 'nur', 'noch', 'schon', 'sehr',
    'über', 'unter', 'nach', 'vor', 'zwischen',
    'alles', 'alle', 'allem', 'allen',
    'kann', 'kannst', 'können', 'könnte',
    'dazu', 'dabei', 'damit', 'darüber',
    'gibt', 'gab', 'geben',
  ])

  const words = text
    .toLowerCase()
    .replace(/[^\wäöüß\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1)

  // Keep question words + content words
  return words.filter(word =>
    questionWords.has(word) || (word.length > 2 && !stopWords.has(word))
  )
}

/**
 * Calculate relevance score for a document based on query
 */
function calculateDocumentRelevance(
  doc: DocumentEntry,
  keywords: string[]
): number {
  if (!doc.context || keywords.length === 0) return 0

  const context = doc.context
  let score = 0
  let totalWeight = 0

  // Search in summary (high weight)
  const summaryText = [
    context.summary.brief,
    context.summary.standard,
    context.summary.comprehensive,
  ].join(' ').toLowerCase()

  const summaryMatches = keywords.filter(kw => summaryText.includes(kw)).length
  score += (summaryMatches / keywords.length) * 0.3
  totalWeight += 0.3

  // Search in topics (medium weight)
  const topicText = context.topics
    .flatMap(t => [t.name, ...t.subtopics, ...t.relatedKeywords])
    .join(' ')
    .toLowerCase()

  const topicMatches = keywords.filter(kw => topicText.includes(kw)).length
  score += (topicMatches / keywords.length) * 0.2
  totalWeight += 0.2

  // Search in entities (medium weight)
  const entityText = context.entities
    .map(e => `${e.text} ${e.context || ''}`)
    .join(' ')
    .toLowerCase()

  const entityMatches = keywords.filter(kw => entityText.includes(kw)).length
  score += (entityMatches / keywords.length) * 0.2
  totalWeight += 0.2

  // Search in key facts (medium weight)
  const factText = context.keyFacts
    .map(f => f.fact)
    .join(' ')
    .toLowerCase()

  const factMatches = keywords.filter(kw => factText.includes(kw)).length
  score += (factMatches / keywords.length) * 0.15
  totalWeight += 0.15

  // Search in action items and decisions (lower weight)
  const actionText = [
    ...context.actionItems.map(a => `${a.task} ${a.assignee || ''}`),
    ...context.decisions.map(d => d.decision),
    ...context.deadlines.map(dl => dl.description),
  ].join(' ').toLowerCase()

  const actionMatches = keywords.filter(kw => actionText.includes(kw)).length
  score += (actionMatches / keywords.length) * 0.15
  totalWeight += 0.15

  return totalWeight > 0 ? score / totalWeight : 0
}

/**
 * Build a comprehensive context snippet from a document for the prompt
 * Includes ALL entities grouped by type for accurate answers
 */
function buildDocumentSnippet(doc: DocumentEntry, keywords: string[] = []): string {
  if (!doc.context) return `Dokument: ${doc.filename}`

  const context = doc.context
  const parts: string[] = []

  // Check if query is about people/participants
  const isPeopleQuery = keywords.some(kw =>
    ['wer', 'person', 'personen', 'team', 'teilnehmer', 'mitglied', 'mitglieder', 'beteiligt', 'teilgenommen', 'mitarbeiter', 'leiter', 'leitung'].includes(kw)
  )

  // Document name
  parts.push(`📄 Dokument: "${doc.filename}"`)

  // Brief summary
  if (context.summary.brief) {
    parts.push(`Zusammenfassung: ${context.summary.brief}`)
  }

  // Key topics
  if (context.topics.length > 0) {
    const topTopics = context.topics.slice(0, 5).map(t => t.name)
    parts.push(`Themen: ${topTopics.join(', ')}`)
  }

  // Group entities by type for better readability
  if (context.entities.length > 0) {
    const entityGroups: Record<string, string[]> = {}

    for (const entity of context.entities) {
      const type = entity.type || 'sonstiges'
      if (!entityGroups[type]) {
        entityGroups[type] = []
      }
      // Include context if available
      const entityText = entity.context
        ? `${entity.text} (${entity.context})`
        : entity.text
      entityGroups[type].push(entityText)
    }

    // Type labels in German
    const typeLabels: Record<string, string> = {
      person: 'Personen/Teammitglieder',
      company: 'Unternehmen',
      project: 'Projekte',
      technology: 'Technologien',
      deadline: 'Termine',
      decision: 'Entscheidungen',
      sonstiges: 'Sonstiges',
    }

    // For people queries, put persons first and include ALL of them
    const typeOrder = isPeopleQuery
      ? ['person', 'company', 'project', 'technology', 'deadline', 'decision', 'sonstiges']
      : Object.keys(entityGroups)

    for (const type of typeOrder) {
      if (entityGroups[type] && entityGroups[type].length > 0) {
        const label = typeLabels[type] || type
        // Include ALL entities for the queried type, limit others
        const entities = (isPeopleQuery && type === 'person')
          ? entityGroups[type]
          : entityGroups[type].slice(0, 10)
        parts.push(`${label}: ${entities.join('; ')}`)
      }
    }
  }

  // Relationships (important for understanding connections)
  if (context.relationships.length > 0) {
    const relationships = context.relationships
      .slice(0, 8)
      .map(r => `${r.entity1} → ${r.entity2}: ${r.description}`)
    parts.push(`Beziehungen: ${relationships.join('; ')}`)
  }

  // Key facts - include more for comprehensive answers
  if (context.keyFacts.length > 0) {
    const facts = context.keyFacts.slice(0, 8).map(f => f.fact)
    parts.push(`Wichtige Fakten: ${facts.join('; ')}`)
  }

  // Action items if any
  if (context.actionItems.length > 0) {
    const actions = context.actionItems.slice(0, 5).map(a =>
      a.assignee ? `${a.task} (${a.assignee})` : a.task
    )
    parts.push(`Aufgaben: ${actions.join('; ')}`)
  }

  // Decisions
  if (context.decisions.length > 0) {
    const decisions = context.decisions.slice(0, 5).map(d => d.decision)
    parts.push(`Entscheidungen: ${decisions.join('; ')}`)
  }

  // Deadlines if any
  if (context.deadlines.length > 0) {
    const deadlines = context.deadlines.map(d => `${d.description} (${d.date})`)
    parts.push(`Fristen: ${deadlines.join('; ')}`)
  }

  return parts.join('\n')
}

/**
 * Retrieve relevant document context for a query
 */
export function retrieveDocumentContext(
  documents: readonly DocumentEntry[],
  options: DocumentRetrievalOptions
): DocumentRetrievalResult {
  const { query, mode, limit = 3, minRelevance = 0.1 } = options

  // Filter by mode and completion status
  const filteredDocs = documents.filter(
    doc => doc.mode === mode && doc.status === 'complete' && doc.context
  )

  if (filteredDocs.length === 0) {
    return { references: [], matchedDocuments: [], totalMatches: 0 }
  }

  // Extract keywords from query
  const keywords = extractKeywords(query)

  if (keywords.length === 0) {
    return { references: [], matchedDocuments: [], totalMatches: 0 }
  }

  // Score all documents
  const scoredDocs = filteredDocs
    .map(doc => ({
      doc,
      score: calculateDocumentRelevance(doc, keywords),
    }))
    .filter(item => item.score >= minRelevance)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  // Build references with keywords for context-aware snippets
  const references: KnowledgeReference[] = scoredDocs.map(item => ({
    id: `doc:${item.doc.id}`,
    snippet: buildDocumentSnippet(item.doc, keywords),
    relevanceScore: item.score,
    source: 'files' as const,
  }))

  return {
    references,
    matchedDocuments: scoredDocs.map(item => item.doc.filename),
    totalMatches: scoredDocs.length,
  }
}

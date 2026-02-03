/**
 * Knowledge Base Cleanup Module
 * Handles duplicate detection and date enrichment on app startup
 */

import type { KnowledgeEntry } from '@/types/knowledge'
import { calculateCombinedSimilarity } from './similarity'

// German day names for date pattern matching
const GERMAN_DAYS: Record<string, number> = {
  sonntag: 0,
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
}

const GERMAN_DAY_NAMES = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
]

const GERMAN_MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

// Patterns for relative date expressions in content
const RELATIVE_DATE_PATTERNS: Array<{
  pattern: RegExp
  resolver: (match: RegExpMatchArray, referenceDate: Date) => Date | null
}> = [
  // "heute"
  {
    pattern: /\bheute\b/i,
    resolver: (_, ref) => new Date(ref),
  },
  // "morgen"
  {
    pattern: /\bmorgen\b/i,
    resolver: (_, ref) => {
      const date = new Date(ref)
      date.setDate(date.getDate() + 1)
      return date
    },
  },
  // "übermorgen"
  {
    pattern: /\bübermorgen\b/i,
    resolver: (_, ref) => {
      const date = new Date(ref)
      date.setDate(date.getDate() + 2)
      return date
    },
  },
  // "nächsten/nächster Montag/Dienstag/..."
  {
    pattern: /\bn[aä]chste[rn]?\s+(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i,
    resolver: (match, ref) => {
      const dayName = match[1].toLowerCase()
      const targetDay = GERMAN_DAYS[dayName]
      if (targetDay === undefined) return null

      const date = new Date(ref)
      const currentDay = ref.getDay()
      let daysUntil = (targetDay - currentDay + 7) % 7
      if (daysUntil === 0) daysUntil = 7

      date.setDate(ref.getDate() + daysUntil)
      return date
    },
  },
  // "übernächsten/übernächster Montag/..."
  {
    pattern: /\b[uü]bern[aä]chste[rn]?\s+(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i,
    resolver: (match, ref) => {
      const dayName = match[1].toLowerCase()
      const targetDay = GERMAN_DAYS[dayName]
      if (targetDay === undefined) return null

      const date = new Date(ref)
      const currentDay = ref.getDay()
      let daysUntil = (targetDay - currentDay + 7) % 7
      if (daysUntil === 0) daysUntil = 7
      daysUntil += 7

      date.setDate(ref.getDate() + daysUntil)
      return date
    },
  },
  // "am Montag/Dienstag/..."
  {
    pattern: /\bam\s+(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i,
    resolver: (match, ref) => {
      const dayName = match[1].toLowerCase()
      const targetDay = GERMAN_DAYS[dayName]
      if (targetDay === undefined) return null

      const date = new Date(ref)
      const currentDay = ref.getDay()
      let daysUntil = (targetDay - currentDay + 7) % 7
      if (daysUntil === 0) daysUntil = 7

      date.setDate(ref.getDate() + daysUntil)
      return date
    },
  },
  // "in X Tagen"
  {
    pattern: /\bin\s+(\d+)\s+tag(?:en)?\b/i,
    resolver: (match, ref) => {
      const days = parseInt(match[1], 10)
      const date = new Date(ref)
      date.setDate(ref.getDate() + days)
      return date
    },
  },
  // "in X Wochen"
  {
    pattern: /\bin\s+(\d+)\s+woche(?:n)?\b/i,
    resolver: (match, ref) => {
      const weeks = parseInt(match[1], 10)
      const date = new Date(ref)
      date.setDate(ref.getDate() + weeks * 7)
      return date
    },
  },
  // "in X Monaten"
  {
    pattern: /\bin\s+(\d+)\s+monat(?:en)?\b/i,
    resolver: (match, ref) => {
      const months = parseInt(match[1], 10)
      const date = new Date(ref)
      date.setMonth(ref.getMonth() + months)
      return date
    },
  },
  // "nächste Woche"
  {
    pattern: /\bn[aä]chste\s+woche\b/i,
    resolver: (_, ref) => {
      const date = new Date(ref)
      date.setDate(ref.getDate() + 7)
      return date
    },
  },
  // "Ende der Woche" / "Wochenende"
  {
    pattern: /\b(?:ende\s+(?:der\s+)?woche|wochenende)\b/i,
    resolver: (_, ref) => {
      const date = new Date(ref)
      const currentDay = ref.getDay()
      const daysUntilFriday = (5 - currentDay + 7) % 7 || 7
      date.setDate(ref.getDate() + daysUntilFriday)
      return date
    },
  },
  // "Mitte der Woche"
  {
    pattern: /\bmitte\s+(?:der\s+)?woche\b/i,
    resolver: (_, ref) => {
      const date = new Date(ref)
      const currentDay = ref.getDay()
      let daysUntilWednesday = (3 - currentDay + 7) % 7
      if (daysUntilWednesday <= 0) daysUntilWednesday += 7
      date.setDate(ref.getDate() + daysUntilWednesday)
      return date
    },
  },
]

// Pattern to detect already enriched content
const ENRICHED_PATTERN = /\(Termin:\s+[^)]+\)$/

// Pattern to detect absolute dates (DD.MM.YYYY or DD.MM.)
const ABSOLUTE_DATE_PATTERN = /\b\d{1,2}\.\d{1,2}\.(?:\d{2,4})?\b/

export interface DuplicateGroup {
  readonly kept: KnowledgeEntry
  readonly removed: readonly KnowledgeEntry[]
}

export interface CleanupOptions {
  readonly duplicateThreshold?: number
  readonly dateMaxAgeMs?: number
}

export interface CleanupResult {
  readonly entries: readonly KnowledgeEntry[]
  readonly duplicates: {
    readonly groups: readonly DuplicateGroup[]
    readonly removed: readonly KnowledgeEntry[]
  }
  readonly dateEnrichment: {
    readonly modified: readonly KnowledgeEntry[]
  }
}

/**
 * Extract relative date pattern from content
 */
export function extractRelativeDatePattern(
  content: string
): { match: RegExpMatchArray; index: number; resolver: (match: RegExpMatchArray, ref: Date) => Date | null } | null {
  for (const { pattern, resolver } of RELATIVE_DATE_PATTERNS) {
    const match = content.match(pattern)
    if (match && match.index !== undefined) {
      return { match, index: match.index, resolver }
    }
  }
  return null
}

/**
 * Format a date in German
 */
function formatDateShort(date: Date): string {
  const dayName = GERMAN_DAY_NAMES[date.getDay()]
  const day = date.getDate()
  const month = GERMAN_MONTHS[date.getMonth()]
  const year = date.getFullYear()
  return `${dayName}, ${day}. ${month} ${year}`
}

/**
 * Enrich an entry with resolved date if it contains relative date patterns
 */
export function enrichEntryWithDate(
  entry: KnowledgeEntry,
  options: { maxAgeMs: number }
): KnowledgeEntry | null {
  const now = new Date()
  const entryAge = now.getTime() - entry.createdAt.getTime()

  // Skip entries older than maxAge unless they're deadlines
  if (entryAge > options.maxAgeMs && entry.metadata.entityType !== 'deadline') {
    return null
  }

  // Skip if already enriched
  if (ENRICHED_PATTERN.test(entry.content)) {
    return null
  }

  // Skip if absolute date already present
  if (ABSOLUTE_DATE_PATTERN.test(entry.content)) {
    return null
  }

  // Find relative date pattern
  const patternMatch = extractRelativeDatePattern(entry.content)
  if (!patternMatch) {
    return null
  }

  // Resolve date relative to entry creation time
  const resolvedDate = patternMatch.resolver(patternMatch.match, entry.createdAt)
  if (!resolvedDate) {
    return null
  }

  // Create enriched content
  const formattedDate = formatDateShort(resolvedDate)
  const enrichedContent = `${entry.content} (Termin: ${formattedDate})`

  return {
    ...entry,
    content: enrichedContent,
    updatedAt: new Date(),
  }
}

/**
 * Find duplicate groups using optimized length-bucketing approach
 * Uses Union-Find for efficient grouping
 */
export function findDuplicateGroups(
  entries: readonly KnowledgeEntry[],
  threshold: number = 0.75
): DuplicateGroup[] {
  if (entries.length < 2) return []

  // Union-Find data structure
  const parent: number[] = entries.map((_, i) => i)
  const rank: number[] = new Array(entries.length).fill(0)

  function find(x: number): number {
    if (parent[x] !== x) {
      parent[x] = find(parent[x])
    }
    return parent[x]
  }

  function union(x: number, y: number): void {
    const px = find(x)
    const py = find(y)
    if (px === py) return

    if (rank[px] < rank[py]) {
      parent[px] = py
    } else if (rank[px] > rank[py]) {
      parent[py] = px
    } else {
      parent[py] = px
      rank[px]++
    }
  }

  // Create length buckets for optimization
  // Similar entries should have similar lengths
  const lengthBuckets = new Map<number, number[]>()
  const bucketSize = 50 // Characters

  for (let i = 0; i < entries.length; i++) {
    const len = entries[i].content.length
    const bucket = Math.floor(len / bucketSize)

    // Add to current and adjacent buckets for overlap
    for (const b of [bucket - 1, bucket, bucket + 1]) {
      if (b >= 0) {
        const existing = lengthBuckets.get(b) ?? []
        lengthBuckets.set(b, [...existing, i])
      }
    }
  }

  // Compare entries within same buckets
  const compared = new Set<string>()

  for (const indices of lengthBuckets.values()) {
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const idx1 = indices[i]
        const idx2 = indices[j]
        const key = idx1 < idx2 ? `${idx1}-${idx2}` : `${idx2}-${idx1}`

        if (compared.has(key)) continue
        compared.add(key)

        const similarity = calculateCombinedSimilarity(
          entries[idx1].content,
          entries[idx2].content
        )

        if (similarity >= threshold) {
          union(idx1, idx2)
        }
      }
    }
  }

  // Collect groups
  const groups = new Map<number, number[]>()
  for (let i = 0; i < entries.length; i++) {
    const root = find(i)
    const existing = groups.get(root) ?? []
    groups.set(root, [...existing, i])
  }

  // Convert to DuplicateGroup format
  const result: DuplicateGroup[] = []

  for (const indices of groups.values()) {
    if (indices.length < 2) continue

    // Sort by createdAt (newest first)
    const sorted = [...indices].sort((a, b) =>
      entries[b].createdAt.getTime() - entries[a].createdAt.getTime()
    )

    const keptIdx = sorted[0]
    const removedIndices = sorted.slice(1)

    result.push({
      kept: entries[keptIdx],
      removed: removedIndices.map(i => entries[i]),
    })
  }

  return result
}

/**
 * Main cleanup function that processes all entries
 */
export function cleanupKnowledgeEntries(
  entries: readonly KnowledgeEntry[],
  options: CleanupOptions = {}
): CleanupResult {
  const {
    duplicateThreshold = 0.75,
    dateMaxAgeMs = 7 * 24 * 60 * 60 * 1000, // 7 days
  } = options

  // Empty or single entry - nothing to dedupe
  if (entries.length === 0) {
    return {
      entries: [],
      duplicates: { groups: [], removed: [] },
      dateEnrichment: { modified: [] },
    }
  }

  // Step 1: Find and process duplicates
  const duplicateGroups = findDuplicateGroups(entries, duplicateThreshold)
  const removedIds = new Set<string>()

  for (const group of duplicateGroups) {
    for (const removed of group.removed) {
      removedIds.add(removed.id)
    }
  }

  // Filter out removed entries
  const dedupedEntries = entries.filter(e => !removedIds.has(e.id))

  // Step 2: Enrich entries with dates
  const enrichedEntries: KnowledgeEntry[] = []
  const modifiedEntries: KnowledgeEntry[] = []

  for (const entry of dedupedEntries) {
    const enriched = enrichEntryWithDate(entry, { maxAgeMs: dateMaxAgeMs })

    if (enriched) {
      enrichedEntries.push(enriched)
      modifiedEntries.push(enriched)
    } else {
      enrichedEntries.push(entry)
    }
  }

  // Log cleanup results
  if (removedIds.size > 0) {
    console.log(`[Knowledge] Removed ${removedIds.size} duplicates`)
  }
  if (modifiedEntries.length > 0) {
    console.log(`[Knowledge] Enriched ${modifiedEntries.length} entries with dates`)
  }

  return {
    entries: enrichedEntries,
    duplicates: {
      groups: duplicateGroups,
      removed: duplicateGroups.flatMap(g => g.removed),
    },
    dateEnrichment: {
      modified: modifiedEntries,
    },
  }
}

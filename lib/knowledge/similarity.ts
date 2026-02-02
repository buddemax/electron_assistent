/**
 * Knowledge Base Similarity Functions
 * Provides fuzzy matching for duplicate detection
 */

/**
 * Calculate Jaccard similarity coefficient between two strings
 * Based on word-level comparison
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0

  // Split into words, filtering out empty strings
  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 0))
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 0))

  if (words1.size === 0 || words2.size === 0) return 0

  // Calculate Jaccard coefficient: |intersection| / |union|
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

/**
 * Calculate normalized Levenshtein distance for short strings
 * Returns a similarity score between 0 and 1
 */
export function calculateLevenshteinSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0

  const maxLength = Math.max(s1.length, s2.length)
  const distance = levenshteinDistance(s1, s2)

  return 1 - (distance / maxLength)
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length

  // Create a matrix of distances
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        )
      }
    }
  }

  return dp[m][n]
}

/**
 * Combined similarity score using both Jaccard and Levenshtein
 * Weighted average: 60% Jaccard (for content), 40% Levenshtein (for typos)
 */
export function calculateCombinedSimilarity(str1: string, str2: string): number {
  const jaccard = calculateSimilarity(str1, str2)
  const levenshtein = calculateLevenshteinSimilarity(str1, str2)

  return jaccard * 0.6 + levenshtein * 0.4
}

interface ContentEntry {
  readonly content: string
}

/**
 * Check if new content is a duplicate of existing entries
 * Uses combined similarity with configurable threshold
 *
 * @param newContent - The new content to check
 * @param existingEntries - Array of existing entries with content field
 * @param threshold - Similarity threshold (0-1), default 0.75 (75% similar)
 * @returns true if content is considered a duplicate
 */
export function isDuplicate(
  newContent: string,
  existingEntries: readonly ContentEntry[],
  threshold: number = 0.75
): boolean {
  return existingEntries.some(existing =>
    calculateCombinedSimilarity(newContent, existing.content) >= threshold
  )
}

interface ContentEntryWithId extends ContentEntry {
  readonly id: string
}

/**
 * Find the most similar existing entry
 *
 * @param newContent - The content to compare
 * @param existingEntries - Array of existing entries
 * @returns The most similar entry with its similarity score, or null if no entries
 */
export function findMostSimilar(
  newContent: string,
  existingEntries: readonly ContentEntryWithId[]
): { entry: ContentEntryWithId; similarity: number } | null {
  if (existingEntries.length === 0) return null

  let maxSimilarity = 0
  let mostSimilar: ContentEntryWithId | null = null

  for (const entry of existingEntries) {
    const similarity = calculateCombinedSimilarity(newContent, entry.content)
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity
      mostSimilar = entry
    }
  }

  return mostSimilar ? { entry: mostSimilar, similarity: maxSimilarity } : null
}

/**
 * Find all entries above a similarity threshold
 *
 * @param newContent - The content to compare
 * @param existingEntries - Array of existing entries
 * @param threshold - Minimum similarity threshold
 * @returns Array of entries with their similarity scores, sorted by similarity (descending)
 */
export function findSimilarEntries<T extends ContentEntry>(
  newContent: string,
  existingEntries: readonly T[],
  threshold: number = 0.5
): Array<{ entry: T; similarity: number }> {
  return existingEntries
    .map(entry => ({
      entry,
      similarity: calculateCombinedSimilarity(newContent, entry.content)
    }))
    .filter(result => result.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
}

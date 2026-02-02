import type { DailyQuestion, QuestionCategory } from '@/types/daily-questions'
import { getUnansweredQuestions } from './question-pool'

/**
 * Category weights for balanced selection
 * Higher weight = more likely to be selected
 */
const CATEGORY_WEIGHTS: Record<QuestionCategory, number> = {
  goals: 1.5,
  career: 1.4,
  productivity: 1.3,
  communication: 1.2,
  preferences: 1.1,
  personal: 1.0,
  hobbies: 0.9,
}

interface ScoredQuestion {
  readonly question: DailyQuestion
  readonly score: number
}

/**
 * Calculate score for a question based on priority and category weight
 */
function calculateQuestionScore(question: DailyQuestion): number {
  const priorityScore = (11 - question.priority) / 10 // Higher priority (lower number) = higher score
  const categoryWeight = CATEGORY_WEIGHTS[question.category]
  const randomFactor = 0.8 + Math.random() * 0.4 // Random factor between 0.8 and 1.2

  return priorityScore * categoryWeight * randomFactor
}

/**
 * Ensure category diversity in selection
 * Tries to select from different categories when possible
 */
function ensureCategoryDiversity(
  questions: readonly ScoredQuestion[],
  count: number
): readonly DailyQuestion[] {
  const selected: DailyQuestion[] = []
  const usedCategories = new Set<QuestionCategory>()

  // Sort by score descending
  const sortedQuestions = [...questions].sort((a, b) => b.score - a.score)

  // First pass: try to get questions from different categories
  for (const { question } of sortedQuestions) {
    if (selected.length >= count) break
    if (!usedCategories.has(question.category)) {
      selected.push(question)
      usedCategories.add(question.category)
    }
  }

  // Second pass: fill remaining slots with highest scoring questions
  for (const { question } of sortedQuestions) {
    if (selected.length >= count) break
    if (!selected.includes(question)) {
      selected.push(question)
    }
  }

  return selected
}

/**
 * Select questions for a new session
 *
 * Algorithm:
 * 1. Filter: Only unanswered questions
 * 2. Score: Priority + Category weight + Random variance
 * 3. Select: Top N with category diversity
 */
export function selectQuestionsForSession(
  answeredQuestionIds: readonly string[],
  count: number = 3
): readonly DailyQuestion[] {
  const unansweredQuestions = getUnansweredQuestions(answeredQuestionIds)

  // If not enough questions remain, return what we have
  if (unansweredQuestions.length <= count) {
    return unansweredQuestions
  }

  // Score all questions
  const scoredQuestions: ScoredQuestion[] = unansweredQuestions.map(
    (question) => ({
      question,
      score: calculateQuestionScore(question),
    })
  )

  // Select with category diversity
  return ensureCategoryDiversity(scoredQuestions, count)
}

/**
 * Check if a new session should be started
 * A new session starts when:
 * 1. It's a new day (different date)
 * 2. The user hasn't dismissed questions today
 */
export function shouldStartNewSession(
  lastSessionDate: string | null,
  dismissed: boolean
): boolean {
  const today = new Date().toISOString().split('T')[0]

  // New day means new session
  if (lastSessionDate !== today) {
    return true
  }

  // Same day but not dismissed = continue showing
  return !dismissed
}

/**
 * Check if there are questions available to ask
 */
export function hasQuestionsAvailable(
  answeredQuestionIds: readonly string[]
): boolean {
  return getUnansweredQuestions(answeredQuestionIds).length > 0
}

/**
 * Get progress information
 */
export function getQuestionsProgress(answeredQuestionIds: readonly string[]): {
  answered: number
  total: number
  percentage: number
} {
  const total = 60 // Approximate total questions
  const answered = answeredQuestionIds.length
  const percentage = Math.round((answered / total) * 100)

  return { answered, total, percentage }
}

/**
 * Daily Questions types for ongoing user context gathering
 */

export type QuestionCategory =
  | 'personal'
  | 'career'
  | 'goals'
  | 'preferences'
  | 'hobbies'
  | 'communication'
  | 'productivity'

export type QuestionInputType = 'text' | 'select' | 'multi-select'

export interface DailyQuestion {
  readonly id: string
  readonly category: QuestionCategory
  readonly question: string
  readonly inputType: QuestionInputType
  readonly options?: readonly string[]
  readonly placeholder?: string
  readonly aiContextKey: string
  readonly priority: number // 1-10, lower = more important
}

export interface QuestionAnswer {
  readonly questionId: string
  readonly answer: string | readonly string[]
  readonly answeredAt: Date
}

export interface SerializedQuestionAnswer {
  readonly questionId: string
  readonly answer: string | readonly string[]
  readonly answeredAt: string // ISO string for localStorage
}

export interface DailyQuestionsState {
  readonly enabled: boolean
  readonly askedQuestionIds: readonly string[]
  readonly answers: readonly QuestionAnswer[]
  readonly lastSessionDate: string | null // YYYY-MM-DD
  readonly currentSessionQuestionIds: readonly string[]
  readonly dismissed: boolean
}

export const DEFAULT_DAILY_QUESTIONS_STATE: DailyQuestionsState = {
  enabled: true,
  askedQuestionIds: [],
  answers: [],
  lastSessionDate: null,
  currentSessionQuestionIds: [],
  dismissed: false,
}

// Serialization helpers for localStorage persistence
export function serializeAnswers(
  answers: readonly QuestionAnswer[]
): readonly SerializedQuestionAnswer[] {
  return answers.map((answer) => ({
    ...answer,
    answeredAt: answer.answeredAt.toISOString(),
  }))
}

export function deserializeAnswers(
  serialized: readonly SerializedQuestionAnswer[]
): readonly QuestionAnswer[] {
  return serialized.map((answer) => ({
    ...answer,
    answeredAt: new Date(answer.answeredAt),
  }))
}

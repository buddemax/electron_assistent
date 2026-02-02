import type { ExtendedProfileData } from '@/types/profile'
import type { QuestionAnswer } from '@/types/daily-questions'
import { getQuestionById } from './question-pool'

/**
 * Mapping of aiContextKey to ExtendedProfileData field
 * Only profile-relevant questions are included
 */
const AI_CONTEXT_TO_PROFILE_FIELD: Readonly<
  Record<string, keyof ExtendedProfileData>
> = {
  arbeitsmotivation: 'arbeitsmotivation',
  teamarbeit_praeferenz: 'teamarbeitPraeferenz',
  fuehrungsverantwortung: 'fuehrungsverantwortung',
  remote_arbeit: 'remoteArbeit',
  tageszeit_typ: 'tageszeitTyp',
  kommunikations_praeferenz: 'kommunikationsPraeferenz',
  produktivste_zeit: 'produktivsteZeit',
  tagesplanung: 'tagesplanung',
  stressbewaeltigung: 'stressbewaeltigung',
  lesen_praeferenz: 'lernstil',
}

/**
 * Check if a question answer should update the profile
 */
export function shouldSyncToProfile(questionId: string): boolean {
  const question = getQuestionById(questionId)
  if (!question) return false

  return question.aiContextKey in AI_CONTEXT_TO_PROFILE_FIELD
}

/**
 * Get the profile field to update for a given question
 */
export function getProfileFieldForQuestion(
  questionId: string
): keyof ExtendedProfileData | null {
  const question = getQuestionById(questionId)
  if (!question) return null

  return AI_CONTEXT_TO_PROFILE_FIELD[question.aiContextKey] ?? null
}

/**
 * Build profile updates from a question answer
 */
export function buildProfileUpdate(
  answer: QuestionAnswer
): Partial<ExtendedProfileData> | null {
  const question = getQuestionById(answer.questionId)
  if (!question) return null

  const field = AI_CONTEXT_TO_PROFILE_FIELD[question.aiContextKey]
  if (!field) return null

  const answerValue = Array.isArray(answer.answer)
    ? answer.answer.join(', ')
    : answer.answer

  return {
    [field]: answerValue,
  }
}

/**
 * Get all profile-relevant aiContextKeys
 */
export function getProfileRelevantKeys(): readonly string[] {
  return Object.keys(AI_CONTEXT_TO_PROFILE_FIELD)
}

import type { DailyQuestion } from '@/types/daily-questions'
import { getQuestionById } from './question-pool'

export interface ValidationResult {
  readonly isValid: boolean
  readonly error?: string
}

/**
 * Validates that an answer matches the expected input type of a question
 */
export function validateAnswer(
  questionId: string,
  answer: string | readonly string[]
): ValidationResult {
  const question = getQuestionById(questionId)

  if (!question) {
    return {
      isValid: false,
      error: `Question with id "${questionId}" not found`,
    }
  }

  return validateAnswerForQuestion(question, answer)
}

/**
 * Validates answer against question input type
 */
export function validateAnswerForQuestion(
  question: DailyQuestion,
  answer: string | readonly string[]
): ValidationResult {
  const { inputType, options } = question

  switch (inputType) {
    case 'text':
      if (Array.isArray(answer)) {
        return {
          isValid: false,
          error: 'Text questions expect a string answer, not an array',
        }
      }
      if (typeof answer !== 'string' || answer.trim().length === 0) {
        return {
          isValid: false,
          error: 'Text answer cannot be empty',
        }
      }
      return { isValid: true }

    case 'select': {
      if (Array.isArray(answer)) {
        return {
          isValid: false,
          error: 'Select questions expect a single string answer',
        }
      }
      const stringAnswer = answer as string
      if (!options?.includes(stringAnswer)) {
        return {
          isValid: false,
          error: `Answer "${stringAnswer}" is not a valid option`,
        }
      }
      return { isValid: true }
    }

    case 'multi-select':
      if (!Array.isArray(answer)) {
        return {
          isValid: false,
          error: 'Multi-select questions expect an array of answers',
        }
      }
      if (answer.length === 0) {
        return {
          isValid: false,
          error: 'At least one option must be selected',
        }
      }
      const invalidOptions = answer.filter((a) => !options?.includes(a))
      if (invalidOptions.length > 0) {
        return {
          isValid: false,
          error: `Invalid options: ${invalidOptions.join(', ')}`,
        }
      }
      return { isValid: true }

    default:
      return {
        isValid: false,
        error: `Unknown input type: ${inputType}`,
      }
  }
}

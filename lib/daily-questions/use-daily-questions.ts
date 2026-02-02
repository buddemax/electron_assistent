'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import type { DailyQuestion, QuestionAnswer } from '@/types/daily-questions'
import { getQuestionById } from './question-pool'
import {
  selectQuestionsForSession,
  shouldStartNewSession,
  hasQuestionsAvailable,
  getQuestionsProgress,
} from './question-selector'
import { validateAnswer } from './answer-validator'

export interface UseDailyQuestionsReturn {
  readonly shouldShow: boolean
  readonly questions: readonly DailyQuestion[]
  readonly currentQuestionIndex: number
  readonly isComplete: boolean
  readonly progress: {
    readonly answered: number
    readonly total: number
    readonly percentage: number
  }
  readonly onAnswer: (questionId: string, answer: string | readonly string[]) => void
  readonly onDismiss: () => void
  readonly onComplete: () => void
  readonly goToQuestion: (index: number) => void
}

export function useDailyQuestions(): UseDailyQuestionsReturn {
  const {
    dailyQuestions,
    onboardingComplete,
    addQuestionAnswer,
    markSessionQuestionAnswered,
    dismissDailyQuestions,
    setSessionQuestions,
  } = useAppStore()

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const initializedRef = useRef(false)

  // Session answers now come from persisted store (with fallback for old localStorage data)
  const sessionAnswers = dailyQuestions.currentSessionAnsweredIds ?? []

  // Get current session questions
  const questions = useMemo(() => {
    return dailyQuestions.currentSessionQuestionIds
      .map(getQuestionById)
      .filter((q): q is DailyQuestion => q !== undefined)
  }, [dailyQuestions.currentSessionQuestionIds])

  // Check if we should show the modal
  const shouldShow = useMemo(() => {
    if (!onboardingComplete) return false
    if (!dailyQuestions.enabled) return false
    if (dailyQuestions.dismissed) return false
    if (!hasQuestionsAvailable(dailyQuestions.askedQuestionIds)) return false

    // If we have session questions, show them
    if (dailyQuestions.currentSessionQuestionIds.length > 0) {
      // Check if all current session questions are answered
      const allAnswered = dailyQuestions.currentSessionQuestionIds.every((id) =>
        sessionAnswers.includes(id)
      )
      return !allAnswered
    }

    // Check if we should start a new session
    return shouldStartNewSession(
      dailyQuestions.lastSessionDate,
      dailyQuestions.dismissed
    )
  }, [
    onboardingComplete,
    dailyQuestions.enabled,
    dailyQuestions.dismissed,
    dailyQuestions.askedQuestionIds,
    dailyQuestions.currentSessionQuestionIds,
    dailyQuestions.lastSessionDate,
    sessionAnswers,
  ])

  // Initialize session questions if needed
  useEffect(() => {
    if (initializedRef.current) return
    if (!onboardingComplete) return
    if (!dailyQuestions.enabled) return

    const needsNewSession = shouldStartNewSession(
      dailyQuestions.lastSessionDate,
      dailyQuestions.dismissed
    )

    if (needsNewSession && hasQuestionsAvailable(dailyQuestions.askedQuestionIds)) {
      const selectedQuestions = selectQuestionsForSession(
        dailyQuestions.askedQuestionIds,
        3
      )
      if (selectedQuestions.length > 0) {
        setSessionQuestions(selectedQuestions.map((q) => q.id))
      }
    }

    initializedRef.current = true
  }, [
    onboardingComplete,
    dailyQuestions.enabled,
    dailyQuestions.lastSessionDate,
    dailyQuestions.dismissed,
    dailyQuestions.askedQuestionIds,
    setSessionQuestions,
  ])

  // Get progress
  const progress = useMemo(
    () => getQuestionsProgress(dailyQuestions.askedQuestionIds),
    [dailyQuestions.askedQuestionIds]
  )

  // Handle answering a question
  const onAnswer = useCallback(
    (questionId: string, answer: string | readonly string[]) => {
      // Validate answer before saving
      const validation = validateAnswer(questionId, answer)
      if (!validation.isValid) {
        return // Don't save invalid answers
      }

      const questionAnswer: QuestionAnswer = {
        questionId,
        answer,
        answeredAt: new Date(),
      }

      addQuestionAnswer(questionAnswer)
      markSessionQuestionAnswered(questionId)

      // Move to next question if available
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1)
      }
    },
    [addQuestionAnswer, markSessionQuestionAnswered, currentQuestionIndex, questions.length]
  )

  // Handle dismissing for today
  const onDismiss = useCallback(() => {
    dismissDailyQuestions()
  }, [dismissDailyQuestions])

  // Handle completing all questions
  const onComplete = useCallback(() => {
    dismissDailyQuestions()
    setCurrentQuestionIndex(0)
  }, [dismissDailyQuestions])

  // Navigate to specific question
  const goToQuestion = useCallback((index: number) => {
    setCurrentQuestionIndex(index)
  }, [])

  // Check if all questions in session are answered
  const isComplete = useMemo(() => {
    if (questions.length === 0) return true
    return sessionAnswers.length >= questions.length
  }, [questions.length, sessionAnswers.length])

  return {
    shouldShow,
    questions,
    currentQuestionIndex,
    isComplete,
    progress,
    onAnswer,
    onDismiss,
    onComplete,
    goToQuestion,
  }
}

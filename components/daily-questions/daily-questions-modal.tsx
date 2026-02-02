'use client'

import { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DailyQuestion } from '@/types/daily-questions'
import { QuestionCard } from './question-card'

function CloseIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function SparkleIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M18 15l.75 2.25L21 18l-2.25.75L18 21l-.75-2.25L15 18l2.25-.75L18 15z" />
    </svg>
  )
}

interface DailyQuestionsModalProps {
  readonly questions: readonly DailyQuestion[]
  readonly currentIndex: number
  readonly onAnswer: (questionId: string, answer: string | readonly string[]) => void
  readonly onDismiss: () => void
  readonly onComplete: () => void
  readonly onOpenSettings: () => void
}

export function DailyQuestionsModal({
  questions,
  currentIndex,
  onAnswer,
  onDismiss,
  onComplete,
  onOpenSettings,
}: DailyQuestionsModalProps) {
  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1

  const handleAnswer = useCallback(
    (answer: string | readonly string[]) => {
      if (currentQuestion) {
        onAnswer(currentQuestion.id, answer)
        if (isLastQuestion) {
          onComplete()
        }
      }
    },
    [currentQuestion, onAnswer, isLastQuestion, onComplete]
  )

  const handleDismiss = useCallback(() => {
    onDismiss()
  }, [onDismiss])

  const handleDisableClick = useCallback(() => {
    onDismiss()
    onOpenSettings()
  }, [onDismiss, onOpenSettings])

  if (!currentQuestion) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full max-w-lg mx-4 bg-[var(--bg-primary)] rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparkleIcon className="w-5 h-5 text-[var(--accent)]" />
              <span className="font-medium text-[var(--text-primary)]">
                Tägliche Fragen
              </span>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[var(--accent)]"
                initial={{ width: 0 }}
                animate={{
                  width: `${((currentIndex + 1) / questions.length) * 100}%`,
                }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-xs text-[var(--text-tertiary)] tabular-nums">
              {currentIndex + 1}/{questions.length}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          <AnimatePresence mode="wait">
            <QuestionCard
              key={currentQuestion.id}
              question={currentQuestion}
              onAnswer={handleAnswer}
            />
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleDisableClick}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              In Einstellungen deaktivieren
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Später
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

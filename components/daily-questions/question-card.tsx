'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { DailyQuestion } from '@/types/daily-questions'

function CheckIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

interface QuestionCardProps {
  readonly question: DailyQuestion
  readonly onAnswer: (answer: string | readonly string[]) => void
}

export function QuestionCard({ question, onAnswer }: QuestionCardProps) {
  const [textValue, setTextValue] = useState('')
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [selectedOptions, setSelectedOptions] = useState<readonly string[]>([])

  const handleOptionSelect = useCallback(
    (option: string) => {
      if (question.inputType === 'multi-select') {
        setSelectedOptions((prev) =>
          prev.includes(option)
            ? prev.filter((o) => o !== option)
            : [...prev, option]
        )
      } else {
        setSelectedOption(option)
        onAnswer(option)
      }
    },
    [question.inputType, onAnswer]
  )

  const handleTextSubmit = useCallback(() => {
    if (textValue.trim()) {
      onAnswer(textValue.trim())
    }
  }, [textValue, onAnswer])

  const handleMultiSelectSubmit = useCallback(() => {
    if (selectedOptions.length > 0) {
      onAnswer(selectedOptions)
    }
  }, [selectedOptions, onAnswer])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && textValue.trim()) {
        handleTextSubmit()
      }
    },
    [textValue, handleTextSubmit]
  )

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="text-center mb-6">
        <span className="inline-block px-2 py-1 text-xs rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] mb-3 capitalize">
          {question.category}
        </span>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          {question.question}
        </h2>
      </div>

      {question.inputType === 'text' && (
        <div className="space-y-3">
          <input
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={question.placeholder}
            autoFocus
            className={`
              w-full px-4 py-3 rounded-lg
              bg-[var(--bg-secondary)] border border-[var(--border)]
              text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]
              focus:outline-none focus:border-[var(--accent)]
              transition-colors duration-200 text-sm
            `}
          />
          <motion.button
            type="button"
            onClick={handleTextSubmit}
            disabled={!textValue.trim()}
            className={`
              w-full px-4 py-2.5 rounded-lg font-medium text-sm
              transition-all duration-200
              ${
                textValue.trim()
                  ? 'bg-[var(--accent)] text-white hover:opacity-90'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
              }
            `}
            whileHover={textValue.trim() ? { scale: 1.02 } : {}}
            whileTap={textValue.trim() ? { scale: 0.98 } : {}}
          >
            Weiter
          </motion.button>
        </div>
      )}

      {(question.inputType === 'select' || question.inputType === 'multi-select') &&
        question.options && (
          <div className="space-y-3">
            <div className="grid gap-2">
              {question.options.map((option) => {
                const isSelected =
                  question.inputType === 'multi-select'
                    ? selectedOptions.includes(option)
                    : selectedOption === option

                return (
                  <motion.button
                    key={option}
                    type="button"
                    onClick={() => handleOptionSelect(option)}
                    className={`
                      relative w-full px-4 py-3 rounded-lg text-left transition-all duration-200
                      border
                      ${
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                          : 'border-[var(--border)] bg-[var(--bg-secondary)] hover:border-[var(--text-tertiary)]'
                      }
                    `}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`
                          font-medium text-sm
                          ${isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}
                        `}
                      >
                        {option}
                      </span>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center"
                        >
                          <CheckIcon className="w-3 h-3 text-white" />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                )
              })}
            </div>

            {question.inputType === 'multi-select' && (
              <motion.button
                type="button"
                onClick={handleMultiSelectSubmit}
                disabled={selectedOptions.length === 0}
                className={`
                  w-full px-4 py-2.5 rounded-lg font-medium text-sm
                  transition-all duration-200 mt-2
                  ${
                    selectedOptions.length > 0
                      ? 'bg-[var(--accent)] text-white hover:opacity-90'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
                  }
                `}
                whileHover={selectedOptions.length > 0 ? { scale: 1.02 } : {}}
                whileTap={selectedOptions.length > 0 ? { scale: 0.98 } : {}}
              >
                Weiter ({selectedOptions.length} ausgewählt)
              </motion.button>
            )}
          </div>
        )}
    </motion.div>
  )
}

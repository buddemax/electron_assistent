'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { OnboardingStep as OnboardingStepType, UserProfile } from '@/types/profile'
import { OptionCard } from './option-card'

interface OnboardingStepProps {
  readonly step: OnboardingStepType
  readonly value: UserProfile[keyof UserProfile]
  readonly onChange: (value: string | null) => void
}

export function OnboardingStep({ step, value, onChange }: OnboardingStepProps) {
  const [textValue, setTextValue] = useState('')
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  useEffect(() => {
    if (typeof value === 'string') {
      const isFromOptions = step.options?.some((opt) => opt.value === value)
      if (isFromOptions) {
        setSelectedOption(value)
        setTextValue('')
      } else {
        setTextValue(value)
        setSelectedOption(null)
      }
    } else {
      setSelectedOption(null)
      setTextValue('')
    }
  }, [value, step.options])

  const handleOptionSelect = (optionValue: string) => {
    setSelectedOption(optionValue)
    setTextValue('')
    onChange(optionValue)
  }

  const handleTextChange = (newValue: string) => {
    setTextValue(newValue)
    if (newValue.trim()) {
      setSelectedOption(null)
      onChange(newValue.trim())
    } else if (!selectedOption) {
      onChange(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-md mx-auto py-4"
    >
      <div className="text-center mb-4">
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
          {step.title}
        </h2>
        {step.description && (
          <p className="text-sm text-[var(--text-secondary)]">{step.description}</p>
        )}
      </div>

      {(step.type === 'select' || step.type === 'hybrid') && step.options && (
        <div className="grid gap-2">
          {step.options.map((option) => (
            <OptionCard
              key={option.value}
              option={option}
              isSelected={selectedOption === option.value}
              onSelect={() => handleOptionSelect(option.value)}
            />
          ))}
        </div>
      )}

      {(step.type === 'text' || step.type === 'hybrid') && (
        <div className="mt-3">
          {step.type === 'hybrid' && (
            <div className="relative flex items-center gap-4 my-3">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-xs text-[var(--text-tertiary)]">oder</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
          )}
          <input
            type="text"
            value={textValue}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={step.textPlaceholder}
            className={`
              w-full px-3 py-2.5 rounded-lg
              bg-[var(--bg-secondary)] border border-[var(--border)]
              text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]
              focus:outline-none focus:border-[var(--accent)]
              transition-colors duration-200 text-sm
            `}
          />
        </div>
      )}
    </motion.div>
  )
}

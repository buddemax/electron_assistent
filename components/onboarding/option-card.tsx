'use client'

import { motion } from 'framer-motion'
import type { OnboardingOption } from '@/types/profile'

function CheckIcon({ className }: { className?: string }) {
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

interface OptionCardProps {
  readonly option: OnboardingOption
  readonly isSelected: boolean
  readonly onSelect: () => void
}

export function OptionCard({ option, isSelected, onSelect }: OptionCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className={`
        relative w-full px-3 py-2.5 rounded-lg text-left transition-all duration-200
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
        <div className="flex-1 flex items-center gap-2">
          <span
            className={`
              font-medium text-sm
              ${isSelected ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}
            `}
          >
            {option.label}
          </span>
          {option.description && (
            <span className="text-xs text-[var(--text-tertiary)]">
              {option.description}
            </span>
          )}
        </div>
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex-shrink-0 w-4 h-4 rounded-full bg-[var(--accent)] flex items-center justify-center"
          >
            <CheckIcon className="w-2.5 h-2.5 text-white" />
          </motion.div>
        )}
      </div>
    </motion.button>
  )
}

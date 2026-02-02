'use client'

import { motion } from 'framer-motion'

interface OnboardingProgressProps {
  readonly currentStep: number
  readonly totalSteps: number
}

export function OnboardingProgress({
  currentStep,
  totalSteps,
}: OnboardingProgressProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <motion.div
          key={index}
          className={`
            h-2 rounded-full transition-all duration-300
            ${
              index === currentStep
                ? 'w-6 bg-[var(--accent)]'
                : index < currentStep
                  ? 'w-2 bg-[var(--accent)]'
                  : 'w-2 bg-[var(--border)]'
            }
          `}
          initial={false}
          animate={{
            width: index === currentStep ? 24 : 8,
            opacity: index <= currentStep ? 1 : 0.5,
          }}
          transition={{ duration: 0.2 }}
        />
      ))}
    </div>
  )
}

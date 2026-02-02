'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { UserProfile } from '@/types/profile'

function ArrowLeftIcon({ className }: { className?: string }) {
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
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
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
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
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
import { DEFAULT_USER_PROFILE } from '@/types/profile'
import { ONBOARDING_STEPS } from '@/lib/onboarding/steps'
import { OnboardingStep } from './onboarding-step'
import { OnboardingProgress } from './onboarding-progress'

interface OnboardingWizardProps {
  readonly onComplete: (profile: UserProfile) => void
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE)

  const currentStep = ONBOARDING_STEPS[currentStepIndex]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === ONBOARDING_STEPS.length - 1

  const handleFieldChange = useCallback(
    (value: string | null) => {
      const field = currentStep.profileField
      setProfile((prev) => ({
        ...prev,
        [field]: value,
      }))
    },
    [currentStep.profileField]
  )

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onComplete(profile)
    } else {
      setCurrentStepIndex((prev) => prev + 1)
    }
  }, [isLastStep, onComplete, profile])

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => prev - 1)
    }
  }, [isFirstStep])

  const handleSkip = useCallback(() => {
    if (isLastStep) {
      onComplete(profile)
    } else {
      setCurrentStepIndex((prev) => prev + 1)
    }
  }, [isLastStep, onComplete, profile])

  const handleSkipAll = useCallback(() => {
    onComplete(DEFAULT_USER_PROFILE)
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-primary)]">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        {/* Skip All Button */}
        <button
          type="button"
          onClick={handleSkipAll}
          className="absolute top-4 right-4 p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label="Onboarding überspringen"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        {/* Progress */}
        <div className="max-w-lg mx-auto">
          <OnboardingProgress
            currentStep={currentStepIndex}
            totalSteps={ONBOARDING_STEPS.length}
          />
        </div>
      </div>

      {/* Step Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-6">
        <div className="max-w-lg mx-auto">
          <AnimatePresence mode="wait">
            <OnboardingStep
              key={currentStep.id}
              step={currentStep}
              value={profile[currentStep.profileField]}
              onChange={handleFieldChange}
            />
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation - Fixed */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-primary)]">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirstStep}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg
              text-sm font-medium transition-all duration-200
              ${
                isFirstStep
                  ? 'text-[var(--text-muted)] cursor-not-allowed'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
              }
            `}
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Zurück
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Überspringen
            </button>

            <motion.button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isLastStep ? 'Fertig' : 'Weiter'}
              {!isLastStep && <ArrowRightIcon className="w-4 h-4" />}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}

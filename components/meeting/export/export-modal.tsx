'use client'

import { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useExportStore } from '@/stores/export-store'
import { useMeetingStore } from '@/stores/meeting-store'
import { WIZARD_STEPS, WIZARD_STEP_LABELS } from '@/types/export'
import { generateMeetingProtocol, type ExportData } from '@/lib/export/docx-generator'
import { ExportStepDetails } from './export-step-details'
import { ExportStepParticipants } from './export-step-participants'
import { ExportStepAgenda } from './export-step-agenda'
import { ExportStepContent } from './export-step-content'

export function ExportModal() {
  const {
    isOpen,
    currentStep,
    meetingId,
    config,
    participants,
    agenda,
    contentOptions,
    isExporting,
    exportProgress,
    exportStage,
    error,
    closeExportModal,
    nextStep,
    previousStep,
    setStep,
    startExport,
    setExportProgress,
    setExportError,
    completeExport,
  } = useExportStore()

  const getMeetingById = useMeetingStore((state) => state.getMeetingById)

  const currentStepIndex = WIZARD_STEPS.indexOf(currentStep)
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1

  const handleExport = useCallback(async () => {
    if (!meetingId || !config) return

    const meeting = getMeetingById(meetingId)
    if (!meeting) {
      setExportError('Meeting nicht gefunden')
      return
    }

    startExport()

    const exportData: ExportData = {
      config,
      participants,
      agenda,
      contentOptions,
      meeting,
    }

    await generateMeetingProtocol(exportData, {
      onProgress: (progress, stage) => {
        setExportProgress(progress, stage)
      },
      onComplete: (filename) => {
        completeExport()
        // Auto-close after a short delay
        setTimeout(() => {
          closeExportModal()
        }, 1500)
      },
      onError: (err) => {
        setExportError(err.message)
      },
    })
  }, [
    meetingId,
    config,
    participants,
    agenda,
    contentOptions,
    getMeetingById,
    startExport,
    setExportProgress,
    completeExport,
    setExportError,
    closeExportModal,
  ])

  const renderStep = () => {
    switch (currentStep) {
      case 'details':
        return <ExportStepDetails />
      case 'participants':
        return <ExportStepParticipants />
      case 'agenda':
        return <ExportStepAgenda />
      case 'content':
        return <ExportStepContent />
      default:
        return null
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeExportModal}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Protokoll exportieren
              </h2>
              <button
                onClick={closeExportModal}
                className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-white transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-2 mt-4">
              {WIZARD_STEPS.map((step, index) => (
                <button
                  key={step}
                  onClick={() => setStep(step)}
                  disabled={isExporting}
                  className="flex-1 group"
                >
                  <div
                    className={`
                      h-1 rounded-full transition-colors
                      ${
                        index <= currentStepIndex
                          ? 'bg-amber-500'
                          : 'bg-neutral-300 dark:bg-neutral-600'
                      }
                    `}
                  />
                  <span
                    className={`
                      block text-[10px] mt-1 transition-colors font-medium
                      ${
                        index === currentStepIndex
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-neutral-500 dark:text-neutral-400'
                      }
                    `}
                  >
                    {WIZARD_STEP_LABELS[step]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5 max-h-[60vh] overflow-y-auto bg-white dark:bg-neutral-900">
            {isExporting ? (
              <div className="py-12 text-center">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <svg className="w-20 h-20 -rotate-90">
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="#e5e5e5"
                      strokeWidth="8"
                      className="dark:stroke-neutral-700"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="36"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 36}`}
                      strokeDashoffset={`${2 * Math.PI * 36 * (1 - exportProgress / 100)}`}
                      className="transition-all duration-300"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-neutral-900 dark:text-white">
                    {Math.round(exportProgress)}%
                  </span>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">{exportStage}</p>
                {exportProgress === 100 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex items-center justify-center gap-2 text-green-500"
                  >
                    <CheckIcon className="w-5 h-5" />
                    <span className="font-medium">Export erfolgreich!</span>
                  </motion.div>
                )}
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>
            )}

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
              >
                <p className="text-sm text-red-500">{error}</p>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          {!isExporting && (
            <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 flex items-center justify-between">
              <button
                onClick={previousStep}
                disabled={isFirstStep}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${
                    isFirstStep
                      ? 'text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                      : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }
                `}
              >
                Zurück
              </button>

              <div className="flex items-center gap-3">
                {!isLastStep && (
                  <button
                    onClick={nextStep}
                    className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    Überspringen
                  </button>
                )}

                {isLastStep ? (
                  <button
                    onClick={handleExport}
                    className="
                      px-6 py-2 rounded-lg text-sm font-medium
                      bg-amber-500 text-white
                      hover:bg-amber-600
                      transition-colors flex items-center gap-2
                    "
                  >
                    <DownloadIcon className="w-4 h-4" />
                    Als Word exportieren
                  </button>
                ) : (
                  <button
                    onClick={nextStep}
                    className="
                      px-6 py-2 rounded-lg text-sm font-medium
                      bg-amber-500 text-white
                      hover:bg-amber-600
                      transition-colors
                    "
                  >
                    Weiter
                  </button>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  )
}

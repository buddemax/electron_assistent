'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { VoiceInputField } from './voice-input-field'
import { useExportStore } from '@/stores/export-store'

export function ExportStepParticipants() {
  const { participants, addParticipant, updateParticipant, removeParticipant } = useExportStore()
  const [newName, setNewName] = useState('')

  const handleAddParticipant = () => {
    if (newName.trim()) {
      addParticipant({
        name: newName.trim(),
        role: '',
        isOrganizer: participants.length === 0,
      })
      setNewName('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Info text */}
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Ordne den erkannten Sprechern Namen zu oder füge weitere Teilnehmer hinzu.
        Du kannst die Namen auch per Sprache eingeben.
      </p>

      {/* Existing participants */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {participants.map((participant, index) => (
            <motion.div
              key={participant.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
            >
              {/* Speaker indicator */}
              {participant.speakerId && (
                <div className="w-1 h-full min-h-[60px] rounded-full bg-amber-500" />
              )}

              <div className="flex-1 space-y-2">
                {/* Name input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={participant.name}
                    onChange={(e) =>
                      updateParticipant(participant.id, { name: e.target.value })
                    }
                    placeholder="Name"
                    className="
                      flex-1 px-3 py-1.5
                      bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600
                      rounded text-sm text-neutral-900 dark:text-white
                      placeholder:text-neutral-400 dark:placeholder:text-neutral-500
                      focus:outline-none focus:ring-2 focus:ring-amber-500/50
                    "
                  />
                  <input
                    type="text"
                    value={participant.role || ''}
                    onChange={(e) =>
                      updateParticipant(participant.id, { role: e.target.value })
                    }
                    placeholder="Rolle/Position"
                    className="
                      flex-1 px-3 py-1.5
                      bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600
                      rounded text-sm text-neutral-900 dark:text-white
                      placeholder:text-neutral-400 dark:placeholder:text-neutral-500
                      focus:outline-none focus:ring-2 focus:ring-amber-500/50
                    "
                  />
                </div>

                {/* Options row */}
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={participant.isOrganizer || false}
                      onChange={(e) =>
                        updateParticipant(participant.id, { isOrganizer: e.target.checked })
                      }
                      className="w-3.5 h-3.5 rounded border-neutral-300 dark:border-neutral-600 text-amber-500"
                    />
                    <span className="text-neutral-600 dark:text-neutral-400">Moderator</span>
                  </label>

                  {participant.speakerId && (
                    <span className="text-neutral-500 dark:text-neutral-400">
                      Sprecher {index + 1}
                    </span>
                  )}
                </div>
              </div>

              {/* Remove button */}
              <button
                onClick={() => removeParticipant(participant.id)}
                className="p-1.5 rounded hover:bg-red-500/10 text-neutral-400 hover:text-red-500 transition-colors"
                title="Teilnehmer entfernen"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add new participant */}
      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Teilnehmer hinzufügen
        </p>

        <div className="flex gap-2">
          <VoiceInputField
            value={newName}
            onChange={setNewName}
            placeholder="Name eingeben oder diktieren..."
            className="flex-1"
          />
          <button
            onClick={handleAddParticipant}
            disabled={!newName.trim()}
            className="
              px-4 py-2 rounded-lg
              bg-amber-500 text-white
              hover:bg-amber-600
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors text-sm font-medium
            "
          >
            Hinzufügen
          </button>
        </div>

        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Tipp: Du kannst mehrere Namen durch Kommas getrennt diktieren.
        </p>
      </div>
    </div>
  )
}

function TrashIcon({ className }: { className?: string }) {
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
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </svg>
  )
}

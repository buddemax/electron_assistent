'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { VoiceInputField } from './voice-input-field'
import { useExportStore } from '@/stores/export-store'

export function ExportStepAgenda() {
  const { agenda, addAgendaItem, updateAgendaItem, removeAgendaItem } = useExportStore()
  const [newItem, setNewItem] = useState('')

  const handleAddItem = () => {
    if (newItem.trim()) {
      // Check if multiple items (comma-separated)
      const items = newItem.split(',').map((s) => s.trim()).filter(Boolean)
      for (const item of items) {
        addAgendaItem(item)
      }
      setNewItem('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Info text */}
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Füge die Agenda-Punkte des Meetings hinzu. Du kannst sie per Text eingeben
        oder diktieren. Mehrere Punkte können durch Kommas getrennt werden.
      </p>

      {/* Existing agenda items */}
      {agenda.length > 0 && (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {agenda.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3 group"
              >
                {/* Order number */}
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-sm font-medium">
                  {item.order}
                </span>

                {/* Title input */}
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => updateAgendaItem(item.id, { title: e.target.value })}
                  className="
                    flex-1 px-3 py-2
                    bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600
                    rounded-lg text-sm text-neutral-900 dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-amber-500/50
                  "
                />

                {/* Remove button */}
                <button
                  onClick={() => removeAgendaItem(item.id)}
                  className="
                    opacity-0 group-hover:opacity-100
                    p-1.5 rounded hover:bg-red-500/10
                    text-neutral-400 hover:text-red-500
                    transition-all
                  "
                  title="Entfernen"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Empty state */}
      {agenda.length === 0 && (
        <div className="py-8 text-center rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
          <ListIcon className="w-12 h-12 mx-auto text-neutral-400 dark:text-neutral-500 mb-3" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Noch keine Agenda-Punkte hinzugefügt
          </p>
        </div>
      )}

      {/* Add new item */}
      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Agenda-Punkt hinzufügen
        </p>

        <div className="flex gap-2">
          <VoiceInputField
            value={newItem}
            onChange={setNewItem}
            placeholder="Agenda-Punkt eingeben oder diktieren..."
            className="flex-1"
          />
          <button
            onClick={handleAddItem}
            disabled={!newItem.trim()}
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
      </div>

      {/* Skip hint */}
      <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
        Dieser Schritt ist optional. Du kannst ihn überspringen, wenn keine Agenda vorhanden war.
      </p>
    </div>
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

function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
      />
    </svg>
  )
}

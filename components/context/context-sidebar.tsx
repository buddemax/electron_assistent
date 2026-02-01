'use client'

import { motion, AnimatePresence } from 'framer-motion'
import type { LiveSuggestion } from '@/lib/context/live-suggestions'

interface ContextSidebarProps {
  suggestions: readonly LiveSuggestion[]
  isVisible: boolean
  isLoading?: boolean
}

export function ContextSidebar({ suggestions, isVisible, isLoading }: ContextSidebarProps) {
  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="absolute right-4 top-4 bottom-4 w-64 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <ContextIcon className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Kontext
            </span>
            {isLoading && (
              <div className="ml-auto w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2 overflow-auto max-h-[calc(100%-48px)]">
          <AnimatePresence mode="popLayout">
            {suggestions.length > 0 ? (
              suggestions.map((suggestion, index) => (
                <motion.div
                  key={suggestion.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <SuggestionCard suggestion={suggestion} />
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8"
              >
                <p className="text-sm text-[var(--text-muted)]">
                  Spreche, um Kontext-Vorschläge zu sehen
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

interface SuggestionCardProps {
  suggestion: LiveSuggestion
}

function SuggestionCard({ suggestion }: SuggestionCardProps) {
  return (
    <div className="p-3 bg-[var(--bg-secondary)] rounded-[var(--radius-md)] hover:bg-[var(--bg-tertiary)] transition-colors">
      <div className="flex items-start gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-2 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {suggestion.title}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5 line-clamp-2">
            {suggestion.snippet}
          </p>
        </div>
      </div>
      {/* Relevance indicator */}
      <div className="mt-2 flex items-center gap-1">
        <div className="flex-1 h-1 bg-[var(--bg-primary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)]"
            style={{ width: `${suggestion.relevanceScore * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-[var(--text-muted)]">
          {Math.round(suggestion.relevanceScore * 100)}%
        </span>
      </div>
    </div>
  )
}

function ContextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

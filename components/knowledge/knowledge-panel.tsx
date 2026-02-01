'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import { useAppStore } from '@/stores/app-store'
import { KnowledgeEntryCard } from './knowledge-entry-card'
import type { EntityType } from '@/types/knowledge'

interface KnowledgePanelProps {
  onClose: () => void
}

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  person: 'Personen',
  project: 'Projekte',
  technology: 'Technologien',
  company: 'Unternehmen',
  deadline: 'Termine',
  decision: 'Entscheidungen',
  fact: 'Fakten',
  preference: 'Präferenzen',
  unknown: 'Sonstiges',
}

export function KnowledgePanel({ onClose }: KnowledgePanelProps) {
  const [platform, setPlatform] = useState<NodeJS.Platform>('darwin')

  // Get platform for traffic light spacing
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.app.getPlatform().then(setPlatform)
    }
  }, [])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const isMac = platform === 'darwin'
  const { entries, removeEntry } = useKnowledgeStore()
  const { mode } = useAppStore()

  const [filterType, setFilterType] = useState<EntityType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter entries by current mode and type
  const filteredEntries = useMemo(() => {
    return entries
      .filter(entry => entry.mode === mode)
      .filter(entry => filterType === 'all' || entry.metadata.entityType === filterType)
      .filter(entry =>
        searchQuery === '' ||
        entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.metadata.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [entries, mode, filterType, searchQuery])

  // Get entity type counts for filter
  const typeCounts = useMemo(() => {
    const modeEntries = entries.filter(e => e.mode === mode)
    const counts: Record<string, number> = { all: modeEntries.length }

    for (const entry of modeEntries) {
      const type = entry.metadata.entityType || 'unknown'
      counts[type] = (counts[type] || 0) + 1
    }

    return counts
  }, [entries, mode])

  const handleDelete = async (id: string) => {
    removeEntry(id)
    if (window.electronAPI?.knowledge) {
      await window.electronAPI.knowledge.remove(id)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[var(--bg-primary)]"
    >
      {/* Header */}
      <div className="drag-region flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
        <div className={`flex items-center gap-4 no-drag ${isMac ? 'ml-16' : ''}`}>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span className="text-sm font-medium">Zurück</span>
          </button>
          <div className="w-px h-6 bg-[var(--border)]" />
          <h1 className="text-lg font-medium text-[var(--text-primary)]">
            Knowledge Base
          </h1>
          <span className="px-2 py-0.5 text-xs bg-[var(--accent-subtle)] text-[var(--accent)] rounded-full">
            {mode === 'work' ? 'Beruflich' : 'Privat'}
          </span>
        </div>

        <div className="flex items-center gap-3 no-drag">
          <span className="text-sm text-[var(--text-tertiary)]">
            {filteredEntries.length} Einträge
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
            title="Schließen (Esc)"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-4 no-drag">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] rounded-[var(--radius-md)]">
            <FilterButton
              active={filterType === 'all'}
              onClick={() => setFilterType('all')}
              count={typeCounts.all}
            >
              Alle
            </FilterButton>
            {Object.entries(ENTITY_TYPE_LABELS).map(([type, label]) => {
              const count = typeCounts[type] || 0
              if (count === 0) return null
              return (
                <FilterButton
                  key={type}
                  active={filterType === type}
                  onClick={() => setFilterType(type as EntityType)}
                  count={count}
                >
                  {label}
                </FilterButton>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6" style={{ height: 'calc(100vh - 140px)' }}>
        <AnimatePresence mode="popLayout">
          {filteredEntries.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-64 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
                <DatabaseIcon className="w-8 h-8 text-[var(--text-muted)]" />
              </div>
              <p className="text-[var(--text-secondary)] mb-1">
                Keine Einträge gefunden
              </p>
              <p className="text-sm text-[var(--text-tertiary)]">
                {searchQuery
                  ? 'Versuche eine andere Suche'
                  : 'Sprich etwas, um Wissen zu speichern'}
              </p>
            </motion.div>
          ) : (
            <div className="grid gap-3">
              {filteredEntries.map((entry) => (
                <KnowledgeEntryCard
                  key={entry.id}
                  entry={entry}
                  onDelete={() => handleDelete(entry.id)}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

interface FilterButtonProps {
  active: boolean
  onClick: () => void
  count?: number
  children: React.ReactNode
}

function FilterButton({ active, onClick, count, children }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)]
        transition-all duration-[var(--transition-fast)]
        ${
          active
            ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
        }
      `}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className="ml-1.5 opacity-60">{count}</span>
      )}
    </button>
  )
}

// Icons
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function DatabaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

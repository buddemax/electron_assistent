'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useKnowledgeStore } from '@/stores/knowledge-store'
import { useDocumentStore } from '@/stores/document-store'
import { useAppStore } from '@/stores/app-store'
import { KnowledgeEntryCard } from './knowledge-entry-card'
import { DocumentUpload, DocumentList } from '@/components/document'
import type { EntityType } from '@/types/knowledge'

interface KnowledgePanelProps {
  onClose: () => void
}

type ViewMode = 'knowledge' | 'documents'

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

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.app.getPlatform().then(setPlatform)
    }
  }, [])

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
  const { getDocumentsByMode } = useDocumentStore()
  const { mode } = useAppStore()

  const [viewMode, setViewMode] = useState<ViewMode>('knowledge')
  const [filterType, setFilterType] = useState<EntityType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showDocumentUpload, setShowDocumentUpload] = useState(false)

  const documentCount = getDocumentsByMode(mode).length

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
      className="fixed inset-0 z-50 flex flex-col bg-[var(--bg-primary)]"
    >
      {/* Header */}
      <header className="drag-region flex-shrink-0 border-b border-[var(--border)]">
        {/* Top row - Title and Close */}
        <div className={`flex items-center justify-between px-5 pt-4 pb-2 ${isMac ? 'pl-20' : ''}`}>
          <div className="flex items-center gap-3 no-drag">
            <button
              onClick={onClose}
              className="p-1.5 -ml-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
              title="Zurück (Esc)"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
            <h1 className="text-base font-semibold text-[var(--text-primary)]">
              Speicher
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-[var(--accent-subtle)] text-[var(--accent)] rounded-full">
              {mode === 'work' ? 'Beruflich' : 'Privat'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors no-drag"
            title="Schließen (Esc)"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom row - Tabs and Actions */}
        <div className={`flex items-center justify-between px-5 pb-3 ${isMac ? 'pl-20' : ''}`}>
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-[var(--bg-secondary)] rounded-xl no-drag">
            <button
              onClick={() => setViewMode('knowledge')}
              className={`
                flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg
                transition-all duration-200
                ${viewMode === 'knowledge'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }
              `}
            >
              <BrainIcon className="w-3.5 h-3.5" />
              Wissen
              {typeCounts.all > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] rounded-md ${
                  viewMode === 'knowledge'
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                    : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'
                }`}>
                  {typeCounts.all}
                </span>
              )}
            </button>
            <button
              onClick={() => setViewMode('documents')}
              className={`
                flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg
                transition-all duration-200
                ${viewMode === 'documents'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }
              `}
            >
              <FileIcon className="w-3.5 h-3.5" />
              Dokumente
              {documentCount > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] rounded-md ${
                  viewMode === 'documents'
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                    : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'
                }`}>
                  {documentCount}
                </span>
              )}
            </button>
          </div>

          {/* Upload button - always visible, text hidden on very small screens */}
          {viewMode === 'documents' && (
            <button
              onClick={() => setShowDocumentUpload(true)}
              className="flex-shrink-0 flex items-center justify-center gap-2 p-1.5 sm:px-3 sm:py-1.5 text-xs font-medium bg-[var(--accent)] text-[var(--bg-primary)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors shadow-sm no-drag"
              title="Hochladen"
            >
              <UploadIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">Hochladen</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Compact Search & Filter Bar (for Knowledge view) */}
        {viewMode === 'knowledge' && (
          <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 flex-wrap">
                <FilterPill
                  active={filterType === 'all'}
                  onClick={() => setFilterType('all')}
                  count={typeCounts.all}
                >
                  Alle
                </FilterPill>

                {Object.entries(ENTITY_TYPE_LABELS).map(([type, label]) => {
                  const count = typeCounts[type] || 0
                  if (count === 0) return null
                  return (
                    <FilterPill
                      key={type}
                      active={filterType === type}
                      onClick={() => setFilterType(type as EntityType)}
                      count={count}
                    >
                      {label}
                    </FilterPill>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 max-w-3xl mx-auto">
            <AnimatePresence mode="popLayout">
              {viewMode === 'knowledge' ? (
                filteredEntries.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-20 text-center"
                  >
                    <div className="w-20 h-20 rounded-2xl bg-[var(--bg-secondary)] flex items-center justify-center mb-6">
                      <DatabaseIcon className="w-10 h-10 text-[var(--text-muted)]" />
                    </div>
                    <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                      Keine Einträge gefunden
                    </h3>
                    <p className="text-sm text-[var(--text-tertiary)] max-w-sm">
                      {searchQuery
                        ? 'Versuche eine andere Suche oder wähle eine andere Kategorie'
                        : 'Sprich etwas, um Wissen zu speichern. Deine Einträge erscheinen hier.'}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3"
                  >
                    {/* Results header */}
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-[var(--text-tertiary)]">
                        {filteredEntries.length} {filteredEntries.length === 1 ? 'Eintrag' : 'Einträge'}
                        {filterType !== 'all' && ` in ${ENTITY_TYPE_LABELS[filterType as EntityType]}`}
                      </p>
                    </div>

                    {/* Entries grid */}
                    <div className="grid gap-3">
                      {filteredEntries.map((entry, index) => (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <KnowledgeEntryCard
                            entry={entry}
                            onDelete={() => handleDelete(entry.id)}
                          />
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <DocumentList />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Document Upload Modal */}
      <AnimatePresence>
        {showDocumentUpload && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowDocumentUpload(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-[var(--bg-elevated)] rounded-2xl p-6 shadow-xl border border-[var(--border)]"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
                    <UploadIcon className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                      Dokument hochladen
                    </h3>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      PDF, Word oder PowerPoint
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDocumentUpload(false)}
                  className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>
              <DocumentUpload
                onUploadComplete={() => setShowDocumentUpload(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

interface FilterPillProps {
  active: boolean
  onClick: () => void
  count?: number
  children: React.ReactNode
}

function FilterPill({ active, onClick, count, children }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
        transition-all duration-200 whitespace-nowrap
        ${active
          ? 'bg-[var(--accent)] text-[var(--bg-primary)]'
          : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] border border-[var(--border)]'
        }
      `}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={`
          px-1 py-0.5 text-[10px] rounded
          ${active
            ? 'bg-white/20'
            : 'bg-[var(--bg-secondary)]'
          }
        `}>
          {count}
        </span>
      )}
    </button>
  )
}

function CategoryIcon({ type }: { type: EntityType }) {
  const icons: Record<EntityType, React.ReactNode> = {
    person: <UserIcon className="w-4 h-4" />,
    project: <FolderIcon className="w-4 h-4" />,
    technology: <CodeIcon className="w-4 h-4" />,
    company: <BuildingIcon className="w-4 h-4" />,
    deadline: <ClockIcon className="w-4 h-4" />,
    decision: <CheckCircleIcon className="w-4 h-4" />,
    fact: <InfoIcon className="w-4 h-4" />,
    preference: <HeartIcon className="w-4 h-4" />,
    unknown: <CircleIcon className="w-4 h-4" />,
  }
  return icons[type] || <CircleIcon className="w-4 h-4" />
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
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54" />
    </svg>
  )
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
    </svg>
  )
}

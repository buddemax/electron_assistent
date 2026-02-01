'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { KnowledgeEntry, EntityType } from '@/types/knowledge'

interface KnowledgeEntryCardProps {
  entry: KnowledgeEntry
  onDelete: () => void
}

const ENTITY_TYPE_CONFIG: Record<EntityType, { label: string; color: string; icon: React.ReactNode }> = {
  person: {
    label: 'Person',
    color: 'var(--node-person)',
    icon: <PersonIcon className="w-4 h-4" />,
  },
  project: {
    label: 'Projekt',
    color: 'var(--node-project)',
    icon: <ProjectIcon className="w-4 h-4" />,
  },
  technology: {
    label: 'Technologie',
    color: 'var(--node-technology)',
    icon: <TechIcon className="w-4 h-4" />,
  },
  company: {
    label: 'Unternehmen',
    color: 'var(--node-company)',
    icon: <CompanyIcon className="w-4 h-4" />,
  },
  deadline: {
    label: 'Termin',
    color: 'var(--node-deadline)',
    icon: <DeadlineIcon className="w-4 h-4" />,
  },
  decision: {
    label: 'Entscheidung',
    color: 'var(--node-decision)',
    icon: <DecisionIcon className="w-4 h-4" />,
  },
  fact: {
    label: 'Fakt',
    color: 'var(--node-fact)',
    icon: <FactIcon className="w-4 h-4" />,
  },
  preference: {
    label: 'Präferenz',
    color: 'var(--node-preference)',
    icon: <PreferenceIcon className="w-4 h-4" />,
  },
  unknown: {
    label: 'Sonstiges',
    color: 'var(--text-tertiary)',
    icon: <UnknownIcon className="w-4 h-4" />,
  },
}

export function KnowledgeEntryCard({ entry, onDelete }: KnowledgeEntryCardProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  const typeConfig = ENTITY_TYPE_CONFIG[entry.metadata.entityType || 'unknown']
  const createdDate = new Date(entry.createdAt)

  const handleDeleteClick = () => {
    if (showConfirmDelete) {
      onDelete()
    } else {
      setShowConfirmDelete(true)
      setTimeout(() => setShowConfirmDelete(false), 3000)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group relative bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] p-4 hover:border-[var(--border)] transition-colors"
    >
      {/* Type indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[var(--radius-md)]"
        style={{ backgroundColor: typeConfig.color }}
      />

      <div className="flex items-start gap-3 pl-2">
        {/* Icon */}
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${typeConfig.color}20`, color: typeConfig.color }}
        >
          {typeConfig.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${typeConfig.color}20`, color: typeConfig.color }}
            >
              {typeConfig.label}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {createdDate.toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
              })}{' '}
              {createdDate.toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            {entry.content}
          </p>

          {/* Tags */}
          {entry.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {entry.metadata.tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-0.5 bg-[var(--bg-elevated)] text-[var(--text-tertiary)] rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleDeleteClick}
            className={`
              p-2 rounded-[var(--radius-sm)] transition-colors
              ${showConfirmDelete
                ? 'bg-[var(--error-subtle)] text-[var(--error)]'
                : 'text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error-subtle)]'
              }
            `}
            title={showConfirmDelete ? 'Nochmal klicken zum Löschen' : 'Löschen'}
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// Icons
function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function ProjectIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function TechIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function CompanyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  )
}

function DeadlineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}

function DecisionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function FactIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  )
}

function PreferenceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

function UnknownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

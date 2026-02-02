'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DocumentEntry, DocumentContext, DocumentEntity } from '@/types/document'
import { DOCUMENT_TYPE_LABELS } from '@/types/document'
import { formatFileSize, formatDate } from '@/lib/document/utils'

interface DocumentContextViewerProps {
  readonly document: DocumentEntry
  readonly onClose?: () => void
}

type ViewTab = 'summary' | 'entities' | 'facts' | 'actions' | 'raw'

const TAB_LABELS: Record<ViewTab, string> = {
  summary: 'Zusammenfassung',
  entities: 'Entitäten',
  facts: 'Fakten',
  actions: 'Aktionen',
  raw: 'Volltext',
}

export function DocumentContextViewer({
  document,
  onClose,
}: DocumentContextViewerProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>('summary')
  const { context } = document

  if (!context) {
    return (
      <div className="p-6 text-center text-[var(--text-tertiary)]">
        Kein Kontext verfügbar
      </div>
    )
  }

  const getTabCount = (tab: ViewTab): number | null => {
    switch (tab) {
      case 'entities':
        return context.entities.length + context.relationships.length
      case 'facts':
        return context.keyFacts.length
      case 'actions':
        return context.actionItems.length + context.decisions.length + context.deadlines.length
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-elevated)] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <FileTypeIcon type={document.fileType} />
          <div>
            <h3 className="font-medium text-[var(--text-primary)]">
              {document.filename}
            </h3>
            <p className="text-xs text-[var(--text-tertiary)]">
              {DOCUMENT_TYPE_LABELS[document.fileType]} • {formatFileSize(document.fileSize)}
              {document.pageCount && ` • ${document.pageCount} Seiten`}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] overflow-x-auto">
        {(Object.keys(TAB_LABELS) as ViewTab[]).map((tab) => {
          const count = getTabCount(tab)
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap
                transition-colors border-b-2 -mb-px
                ${
                  activeTab === tab
                    ? 'text-[var(--accent)] border-[var(--accent)]'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }
              `}
            >
              {TAB_LABELS[tab]}
              {count !== null && count > 0 && (
                <span
                  className={`
                    px-1.5 py-0.5 text-[10px] rounded-full
                    ${activeTab === tab ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]'}
                  `}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'summary' && <SummaryView context={context} />}
            {activeTab === 'entities' && <EntitiesView context={context} />}
            {activeTab === 'facts' && <FactsView context={context} />}
            {activeTab === 'actions' && <ActionsView context={context} />}
            {activeTab === 'raw' && <RawTextView text={document.rawText} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
        Verarbeitet: {formatDate(context.processingTimestamp)} • Konfidenz: {Math.round(context.confidence * 100)}%
      </div>
    </div>
  )
}

function SummaryView({ context }: { context: DocumentContext }) {
  return (
    <div className="space-y-6">
      {/* Brief Summary */}
      <div>
        <h4 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
          Kurzfassung
        </h4>
        <p className="text-sm text-[var(--text-primary)]">{context.summary.brief}</p>
      </div>

      {/* Standard Summary */}
      <div>
        <h4 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
          Zusammenfassung
        </h4>
        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
          {context.summary.standard}
        </p>
      </div>

      {/* Topics */}
      {context.topics.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
            Themen
          </h4>
          <div className="space-y-2">
            {context.topics.map((topic, i) => (
              <div key={i} className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-[var(--text-primary)]">
                    {topic.name}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {Math.round(topic.relevance * 100)}%
                  </span>
                </div>
                {topic.subtopics.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {topic.subtopics.map((sub, j) => (
                      <span
                        key={j}
                        className="px-2 py-0.5 text-xs bg-[var(--bg-primary)] text-[var(--text-secondary)] rounded"
                      >
                        {sub}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comprehensive Summary */}
      <div>
        <h4 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
          Ausführliche Zusammenfassung
        </h4>
        <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
          {context.summary.comprehensive}
        </p>
      </div>
    </div>
  )
}

function EntitiesView({ context }: { context: DocumentContext }) {
  const entityGroups = context.entities.reduce(
    (acc, entity) => {
      if (!acc[entity.type]) acc[entity.type] = []
      acc[entity.type].push(entity)
      return acc
    },
    {} as Record<string, DocumentEntity[]>
  )

  const typeLabels: Record<string, string> = {
    person: 'Personen',
    company: 'Unternehmen',
    project: 'Projekte',
    technology: 'Technologien',
    deadline: 'Termine',
    decision: 'Entscheidungen',
    fact: 'Fakten',
    preference: 'Präferenzen',
  }

  return (
    <div className="space-y-6">
      {/* Entities by type */}
      {Object.entries(entityGroups).map(([type, entities]) => (
        <div key={type}>
          <h4 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
            {typeLabels[type] || type}
          </h4>
          <div className="space-y-2">
            {entities.map((entity, i) => (
              <div key={i} className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-[var(--text-primary)]">
                    {entity.text}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {entity.mentions}x erwähnt
                  </span>
                </div>
                {entity.context && (
                  <p className="text-xs text-[var(--text-tertiary)] mt-1 line-clamp-2">
                    {entity.context}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Relationships */}
      {context.relationships.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
            Beziehungen
          </h4>
          <div className="space-y-2">
            {context.relationships.map((rel, i) => (
              <div key={i} className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-[var(--accent)]">{rel.entity1}</span>
                  <span className="text-[var(--text-muted)]">→</span>
                  <span className="font-medium text-[var(--accent)]">{rel.entity2}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {rel.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FactsView({ context }: { context: DocumentContext }) {
  const categoryLabels: Record<string, string> = {
    statistic: 'Statistik',
    claim: 'Behauptung',
    definition: 'Definition',
    requirement: 'Anforderung',
    other: 'Sonstiges',
  }

  const categoryColors: Record<string, string> = {
    statistic: 'bg-blue-500/20 text-blue-400',
    claim: 'bg-yellow-500/20 text-yellow-400',
    definition: 'bg-purple-500/20 text-purple-400',
    requirement: 'bg-red-500/20 text-red-400',
    other: 'bg-gray-500/20 text-gray-400',
  }

  return (
    <div className="space-y-3">
      {context.keyFacts.map((fact, i) => (
        <div key={i} className="p-3 bg-[var(--bg-secondary)] rounded-lg">
          <div className="flex items-start gap-2">
            <span
              className={`px-2 py-0.5 text-[10px] rounded ${categoryColors[fact.category] || categoryColors.other}`}
            >
              {categoryLabels[fact.category] || fact.category}
            </span>
            <div className="flex-1">
              <p className="text-sm text-[var(--text-primary)]">{fact.fact}</p>
              {fact.source && (
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Quelle: {fact.source}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}

      {context.keyFacts.length === 0 && (
        <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
          Keine Fakten extrahiert
        </p>
      )}
    </div>
  )
}

function ActionsView({ context }: { context: DocumentContext }) {
  const priorityColors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    low: 'bg-green-500/20 text-green-400',
  }

  return (
    <div className="space-y-6">
      {/* Action Items */}
      {context.actionItems.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
            Aufgaben
          </h4>
          <div className="space-y-2">
            {context.actionItems.map((item, i) => (
              <div key={i} className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                <div className="flex items-start gap-2">
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded ${priorityColors[item.priority]}`}
                  >
                    {item.priority === 'high' ? 'Hoch' : item.priority === 'medium' ? 'Mittel' : 'Niedrig'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-[var(--text-primary)]">{item.task}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                      {item.assignee && <span>→ {item.assignee}</span>}
                      {item.deadline && <span>Bis: {item.deadline}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decisions */}
      {context.decisions.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
            Entscheidungen
          </h4>
          <div className="space-y-2">
            {context.decisions.map((decision, i) => (
              <div key={i} className="p-3 bg-[var(--bg-secondary)] rounded-lg">
                <p className="text-sm text-[var(--text-primary)]">{decision.decision}</p>
                {decision.rationale && (
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Begründung: {decision.rationale}
                  </p>
                )}
                {decision.stakeholders.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    {decision.stakeholders.map((s, j) => (
                      <span
                        key={j}
                        className="px-1.5 py-0.5 text-[10px] bg-[var(--bg-primary)] text-[var(--text-tertiary)] rounded"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deadlines */}
      {context.deadlines.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
            Fristen
          </h4>
          <div className="space-y-2">
            {context.deadlines.map((deadline, i) => (
              <div key={i} className="p-3 bg-[var(--bg-secondary)] rounded-lg flex items-center gap-3">
                <CalendarIcon className="w-4 h-4 text-[var(--accent)]" />
                <div>
                  <p className="text-sm text-[var(--text-primary)]">{deadline.description}</p>
                  <p className="text-xs text-[var(--accent)]">{deadline.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {context.actionItems.length === 0 &&
        context.decisions.length === 0 &&
        context.deadlines.length === 0 && (
          <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
            Keine Aktionen gefunden
          </p>
        )}
    </div>
  )
}

function RawTextView({ text }: { text: string }) {
  return (
    <div className="p-4 bg-[var(--bg-secondary)] rounded-lg max-h-[500px] overflow-auto">
      <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono">
        {text}
      </pre>
    </div>
  )
}

// Icons
function FileTypeIcon({ type }: { type: DocumentEntry['fileType'] }) {
  const colors = {
    pdf: 'text-red-500 bg-red-500/10',
    docx: 'text-blue-500 bg-blue-500/10',
    pptx: 'text-orange-500 bg-orange-500/10',
  }

  return (
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[type]}`}>
      <span className="text-xs font-bold uppercase">{type}</span>
    </div>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

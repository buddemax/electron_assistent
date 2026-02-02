'use client'

import { motion } from 'framer-motion'
import type { DocumentEntry } from '@/types/document'
import { DOCUMENT_TYPE_LABELS } from '@/types/document'
import { formatFileSize, formatDate } from '@/lib/document/utils'

interface DocumentCardProps {
  readonly document: DocumentEntry
  readonly onClick?: () => void
  readonly onDelete?: () => void
}

export function DocumentCard({ document, onClick, onDelete }: DocumentCardProps) {
  const { context } = document

  return (
    <motion.div
      className="p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] hover:border-[var(--accent)] transition-colors cursor-pointer"
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-start gap-3">
        <FileTypeIcon type={document.fileType} />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-[var(--text-primary)] truncate">
            {document.filename}
          </h4>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            {DOCUMENT_TYPE_LABELS[document.fileType]} • {formatFileSize(document.fileSize)}
            {document.pageCount && ` • ${document.pageCount} Seiten`}
            {document.slideCount && ` • ${document.slideCount} Folien`}
          </p>

          {context && (
            <p className="text-xs text-[var(--text-secondary)] mt-2 line-clamp-2">
              {context.summary.brief}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2">
            {context && context.topics.length > 0 && (
              <div className="flex items-center gap-1">
                {context.topics.slice(0, 2).map((topic) => (
                  <span
                    key={topic.name}
                    className="px-1.5 py-0.5 text-[10px] bg-[var(--accent-subtle)] text-[var(--accent)] rounded"
                  >
                    {topic.name}
                  </span>
                ))}
                {context.topics.length > 2 && (
                  <span className="text-[10px] text-[var(--text-muted)]">
                    +{context.topics.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 rounded transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Processing status */}
      {document.status !== 'complete' && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-2">
            {document.status === 'error' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[var(--error)]" />
                <span className="text-xs text-[var(--error)]">
                  {document.processingError || 'Fehler bei der Verarbeitung'}
                </span>
              </>
            ) : (
              <>
                <div className="w-3 h-3 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                <span className="text-xs text-[var(--text-secondary)]">
                  {document.status === 'pending' && 'Warte auf Verarbeitung...'}
                  {document.status === 'extracting' && 'Text wird extrahiert...'}
                  {document.status === 'analyzing' && 'Kontext wird analysiert...'}
                </span>
              </>
            )}
          </div>
          {document.processingProgress > 0 && document.processingProgress < 100 && (
            <div className="mt-2 w-full h-1 bg-[var(--bg-primary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                style={{ width: `${document.processingProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Timestamp */}
      <p className="text-[10px] text-[var(--text-muted)] mt-2">
        {formatDate(document.uploadedAt)}
      </p>
    </motion.div>
  )
}

function FileTypeIcon({ type }: { type: DocumentEntry['fileType'] }) {
  const colors = {
    pdf: 'text-red-500',
    docx: 'text-blue-500',
    pptx: 'text-orange-500',
  }

  return (
    <div
      className={`w-10 h-10 rounded-lg bg-[var(--bg-primary)] flex items-center justify-center ${colors[type]}`}
    >
      {type === 'pdf' && <PDFIcon className="w-5 h-5" />}
      {type === 'docx' && <DocIcon className="w-5 h-5" />}
      {type === 'pptx' && <SlidesIcon className="w-5 h-5" />}
    </div>
  )
}

function PDFIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13H10v5H8.5v-5zm3 0h1.5v5H11.5v-5zm3 0h1.5v5H14.5v-5z" />
    </svg>
  )
}

function DocIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8 12h8v2H8v-2zm0 4h8v2H8v-2z" />
    </svg>
  )
}

function SlidesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 16H5V5h14v14zM7 12l5 4 5-4-5-4-5 4z" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

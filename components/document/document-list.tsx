'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { useDocumentStore } from '@/stores/document-store'
import type { DocumentEntry } from '@/types/document'
import { DocumentCard } from './document-card'
import { DocumentContextViewer } from './document-context-viewer'

interface DocumentListProps {
  readonly onDocumentSelect?: (document: DocumentEntry) => void
}

export function DocumentList({ onDocumentSelect }: DocumentListProps) {
  const { mode } = useAppStore()
  const { documents, removeDocument, getDocumentsByMode } = useDocumentStore()
  const [selectedDocument, setSelectedDocument] = useState<DocumentEntry | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const filteredDocuments = getDocumentsByMode(mode)

  const handleDocumentClick = (doc: DocumentEntry) => {
    setSelectedDocument(doc)
    onDocumentSelect?.(doc)
  }

  const handleDelete = (docId: string) => {
    if (confirmDelete === docId) {
      removeDocument(docId)
      setConfirmDelete(null)
      if (selectedDocument?.id === docId) {
        setSelectedDocument(null)
      }
    } else {
      setConfirmDelete(docId)
      // Reset after 3 seconds
      setTimeout(() => setConfirmDelete(null), 3000)
    }
  }

  if (filteredDocuments.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-[var(--text-tertiary)]">
          Keine Dokumente vorhanden
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {filteredDocuments.map((doc) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <DocumentCard
              document={doc}
              onClick={() => handleDocumentClick(doc)}
              onDelete={() => handleDelete(doc.id)}
            />
            {confirmDelete === doc.id && (
              <p className="text-xs text-[var(--error)] mt-1 text-center">
                Nochmal klicken zum Löschen
              </p>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Document Detail Modal */}
      <AnimatePresence>
        {selectedDocument && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedDocument(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl h-[80vh] rounded-xl shadow-xl border border-[var(--border)]"
            >
              <DocumentContextViewer
                document={selectedDocument}
                onClose={() => setSelectedDocument(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

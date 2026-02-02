'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/stores/app-store'
import { useDocumentStore } from '@/stores/document-store'
import type { DocumentEntry } from '@/types/document'
import {
  ACCEPTED_DOCUMENT_TYPES,
  MAX_DOCUMENT_SIZE,
  getDocumentFileType,
  DOCUMENT_TYPE_LABELS,
  deserializeDocumentEntry,
} from '@/types/document'

interface DocumentUploadProps {
  readonly onUploadComplete?: (document: DocumentEntry) => void
  readonly onClose?: () => void
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

export function DocumentUpload({ onUploadComplete, onClose }: DocumentUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { mode, settings } = useAppStore()
  const { addDocument } = useDocumentStore()

  const handleFile = useCallback(
    async (file: File) => {
      // Validate file type
      const fileType = getDocumentFileType(file.name)
      if (!fileType) {
        setError('Ungültiger Dateityp. Unterstützt: PDF, Word, PowerPoint')
        setUploadState('error')
        return
      }

      // Validate file size
      if (file.size > MAX_DOCUMENT_SIZE) {
        setError(`Datei zu groß. Maximum: ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB`)
        setUploadState('error')
        return
      }

      setUploadState('uploading')
      setProgress(10)
      setError(null)

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('mode', mode)
        formData.append('originalPath', file.name)

        setProgress(30)

        const response = await fetch('/api/document/upload', {
          method: 'POST',
          headers: {
            'x-gemini-api-key': settings.api.geminiApiKey,
          },
          body: formData,
        })

        setProgress(60)
        setUploadState('processing')

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error?.message || 'Upload fehlgeschlagen')
        }

        setProgress(100)
        setUploadState('success')

        // Deserialize dates from API response and add to store
        const document = deserializeDocumentEntry(result.data.document)
        addDocument(document)

        // Callback
        onUploadComplete?.(document)

        // Reset after short delay
        setTimeout(() => {
          setUploadState('idle')
          setProgress(0)
        }, 2000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
        setUploadState('error')
      }
    },
    [mode, settings.api.geminiApiKey, addDocument, onUploadComplete]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleRetry = useCallback(() => {
    setUploadState('idle')
    setProgress(0)
    setError(null)
  }, [])

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.pptx"
        onChange={handleFileSelect}
        className="hidden"
      />

      <motion.div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={uploadState === 'idle' ? handleClick : undefined}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center
          transition-all duration-200 cursor-pointer
          ${
            isDragging
              ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
              : uploadState === 'error'
                ? 'border-[var(--error)] bg-[var(--error)]/10'
                : uploadState === 'success'
                  ? 'border-[var(--success)] bg-[var(--success)]/10'
                  : 'border-[var(--border)] hover:border-[var(--accent)] bg-[var(--bg-secondary)]'
          }
        `}
        whileHover={uploadState === 'idle' ? { scale: 1.01 } : undefined}
        whileTap={uploadState === 'idle' ? { scale: 0.99 } : undefined}
      >
        <AnimatePresence mode="wait">
          {uploadState === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <UploadIcon className="w-10 h-10 mx-auto mb-3 text-[var(--text-muted)]" />
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                {isDragging ? 'Datei hier ablegen' : 'Dokument hochladen'}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                PDF, Word (.docx), PowerPoint (.pptx)
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Max. {MAX_DOCUMENT_SIZE / 1024 / 1024}MB
              </p>
            </motion.div>
          )}

          {(uploadState === 'uploading' || uploadState === 'processing') && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              <p className="text-sm font-medium text-[var(--accent)] mb-2">
                {uploadState === 'uploading' ? 'Wird hochgeladen...' : 'Kontext wird extrahiert...'}
              </p>
              <div className="w-full h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[var(--accent)] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}

          {uploadState === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <CheckIcon className="w-10 h-10 mx-auto mb-3 text-[var(--success)]" />
              <p className="text-sm font-medium text-[var(--success)]">
                Erfolgreich verarbeitet!
              </p>
            </motion.div>
          )}

          {uploadState === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ErrorIcon className="w-10 h-10 mx-auto mb-3 text-[var(--error)]" />
              <p className="text-sm font-medium text-[var(--error)] mb-2">
                {error}
              </p>
              <button
                onClick={handleRetry}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
              >
                Erneut versuchen
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

// Icons
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
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
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function ErrorIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

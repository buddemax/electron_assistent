import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Mode } from '@/types/output'
import type {
  DocumentEntry,
  DocumentStatus,
  DocumentContext,
  SerializedDocumentEntry,
} from '@/types/document'
import {
  serializeDocumentEntry,
  deserializeDocumentEntry,
} from '@/types/document'

interface DocumentState {
  // Document entries
  documents: readonly DocumentEntry[]

  // Processing state
  processingQueue: readonly string[]
  currentlyProcessing: string | null

  // Upload state
  isUploading: boolean
  uploadProgress: number

  // Actions
  addDocument: (doc: DocumentEntry) => void
  updateDocument: (id: string, updates: Partial<DocumentEntry>) => void
  removeDocument: (id: string) => void
  setProcessingStatus: (id: string, status: DocumentStatus, error?: string) => void
  setProcessingProgress: (id: string, progress: number) => void
  setDocumentContext: (id: string, context: DocumentContext) => void
  addKnowledgeEntryId: (documentId: string, knowledgeEntryId: string) => void

  // Queue management
  addToQueue: (documentId: string) => void
  removeFromQueue: (documentId: string) => void
  setCurrentlyProcessing: (documentId: string | null) => void

  // Upload state
  setIsUploading: (isUploading: boolean) => void
  setUploadProgress: (progress: number) => void

  // Queries
  getDocumentById: (id: string) => DocumentEntry | undefined
  getDocumentsByMode: (mode: Mode) => readonly DocumentEntry[]

  // Reset
  reset: () => void
}

const initialState = {
  documents: [] as readonly DocumentEntry[],
  processingQueue: [] as readonly string[],
  currentlyProcessing: null as string | null,
  isUploading: false,
  uploadProgress: 0,
}

export const useDocumentStore = create<DocumentState>()(
  persist(
    (set, get) => ({
      ...initialState,

      addDocument: (doc) =>
        set((state) => ({
          documents: [...state.documents, doc],
        })),

      updateDocument: (id, updates) =>
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id ? { ...doc, ...updates } : doc
          ),
        })),

      removeDocument: (id) =>
        set((state) => ({
          documents: state.documents.filter((doc) => doc.id !== id),
          processingQueue: state.processingQueue.filter((qId) => qId !== id),
          currentlyProcessing:
            state.currentlyProcessing === id ? null : state.currentlyProcessing,
        })),

      setProcessingStatus: (id, status, error) =>
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id
              ? {
                  ...doc,
                  status,
                  processingError: error ?? null,
                  processedAt: status === 'complete' ? new Date() : doc.processedAt,
                }
              : doc
          ),
        })),

      setProcessingProgress: (id, progress) =>
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id ? { ...doc, processingProgress: progress } : doc
          ),
        })),

      setDocumentContext: (id, context) =>
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id
              ? {
                  ...doc,
                  context,
                  status: 'complete' as DocumentStatus,
                  processedAt: new Date(),
                  processingProgress: 100,
                }
              : doc
          ),
        })),

      addKnowledgeEntryId: (documentId, knowledgeEntryId) =>
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === documentId
              ? {
                  ...doc,
                  knowledgeEntryIds: [...doc.knowledgeEntryIds, knowledgeEntryId],
                }
              : doc
          ),
        })),

      // Queue management
      addToQueue: (documentId) =>
        set((state) => ({
          processingQueue: [...state.processingQueue, documentId],
        })),

      removeFromQueue: (documentId) =>
        set((state) => ({
          processingQueue: state.processingQueue.filter((id) => id !== documentId),
        })),

      setCurrentlyProcessing: (documentId) =>
        set({ currentlyProcessing: documentId }),

      // Upload state
      setIsUploading: (isUploading) => set({ isUploading }),
      setUploadProgress: (uploadProgress) => set({ uploadProgress }),

      // Queries
      getDocumentById: (id) => get().documents.find((doc) => doc.id === id),

      getDocumentsByMode: (mode) =>
        get().documents.filter((doc) => doc.mode === mode),

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'voiceos-document-store',
      partialize: (state) => ({
        documents: state.documents,
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null

          const parsed = JSON.parse(str)
          if (parsed.state?.documents) {
            parsed.state.documents = (
              parsed.state.documents as SerializedDocumentEntry[]
            ).map(deserializeDocumentEntry)
          }
          return parsed
        },
        setItem: (name, value) => {
          const toStore = {
            ...value,
            state: {
              ...value.state,
              documents: (value.state.documents as DocumentEntry[]).map(
                serializeDocumentEntry
              ),
            },
          }
          localStorage.setItem(name, JSON.stringify(toStore))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)

// Selectors
export const selectDocuments = (state: DocumentState) => state.documents
export const selectIsProcessing = (state: DocumentState) =>
  state.currentlyProcessing !== null
export const selectProcessingQueue = (state: DocumentState) =>
  state.processingQueue

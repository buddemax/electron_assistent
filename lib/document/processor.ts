/**
 * Main document processing pipeline
 */

import type { Mode } from '@/types/output'
import type {
  DocumentEntry,
  DocumentFileType,
  DocumentContext,
} from '@/types/document'
import { extractTextFromDocument } from './extractors'
import { extractDocumentContext } from './context-extractor'

export interface ProcessDocumentOptions {
  readonly file: File | ArrayBuffer
  readonly filename: string
  readonly fileType: DocumentFileType
  readonly mode: Mode
  readonly originalPath: string
  readonly apiKey: string
  readonly onProgress?: (stage: string, progress: number) => void
}

export interface ProcessDocumentResult {
  readonly document: DocumentEntry
  readonly context: DocumentContext
}

export async function processDocument(
  options: ProcessDocumentOptions
): Promise<ProcessDocumentResult> {
  const { file, filename, fileType, mode, originalPath, apiKey, onProgress } = options

  const documentId = crypto.randomUUID()
  const now = new Date()

  // Report initial progress
  onProgress?.('extracting', 0)

  // Get buffer from file
  const buffer =
    file instanceof ArrayBuffer ? file : await file.arrayBuffer()

  // Extract text from document
  onProgress?.('extracting', 20)
  const extractResult = await extractTextFromDocument(buffer, fileType)
  onProgress?.('extracting', 50)

  // Log extraction results for debugging
  console.error(`[Processor] Extracted ${extractResult.text.length} chars from ${filename}`)
  console.error(`[Processor] Text preview: ${extractResult.text.slice(0, 300)}...`)
  console.error(`[Processor] Pages: ${extractResult.pageCount}`)

  // Extract context using Gemini
  onProgress?.('analyzing', 50)
  const context = await extractDocumentContext(
    extractResult.text,
    filename,
    fileType,
    apiKey
  )
  onProgress?.('analyzing', 90)

  // Build document entry
  const document: DocumentEntry = {
    id: documentId,
    filename,
    originalPath,
    fileType,
    fileSize: buffer.byteLength,
    pageCount: extractResult.pageCount,
    slideCount: extractResult.slideCount,
    status: 'complete',
    processingError: null,
    processingProgress: 100,
    rawText: extractResult.text,
    context: {
      ...context,
      documentId,
    },
    knowledgeEntryIds: [],
    mode,
    uploadedAt: now,
    processedAt: now,
    lastAccessedAt: now,
  }

  onProgress?.('complete', 100)

  return { document, context }
}


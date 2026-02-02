export { extractTextFromPDF } from './pdf-extractor'
export { extractTextFromDOCX } from './docx-extractor'
export { extractTextFromPPTX } from './pptx-extractor'

import type { DocumentFileType } from '@/types/document'
import { extractTextFromPDF } from './pdf-extractor'
import { extractTextFromDOCX } from './docx-extractor'
import { extractTextFromPPTX } from './pptx-extractor'

export interface TextExtractResult {
  readonly text: string
  readonly pageCount: number | null
  readonly slideCount: number | null
  readonly metadata?: Record<string, unknown>
}

export async function extractTextFromDocument(
  buffer: ArrayBuffer,
  fileType: DocumentFileType
): Promise<TextExtractResult> {
  switch (fileType) {
    case 'pdf': {
      const result = await extractTextFromPDF(buffer)
      return {
        text: result.text,
        pageCount: result.pageCount,
        slideCount: null,
        metadata: result.metadata,
      }
    }
    case 'docx': {
      const result = await extractTextFromDOCX(buffer)
      return {
        text: result.text,
        pageCount: null,
        slideCount: null,
        metadata: { messages: result.messages },
      }
    }
    case 'pptx': {
      const result = await extractTextFromPPTX(buffer)
      return {
        text: result.text,
        pageCount: null,
        slideCount: result.slideCount,
        metadata: { slideTexts: result.slideTexts },
      }
    }
    default:
      throw new Error(`Unsupported file type: ${fileType}`)
  }
}

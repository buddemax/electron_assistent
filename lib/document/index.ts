/**
 * Document module - client-safe exports only
 *
 * For server-only functions (extractors, processor), import directly:
 * - import { extractTextFromDocument } from '@/lib/document/extractors'
 * - import { extractDocumentContext } from '@/lib/document/context-extractor'
 * - import { processDocument } from '@/lib/document/processor'
 */

export { formatFileSize, formatDate } from './utils'

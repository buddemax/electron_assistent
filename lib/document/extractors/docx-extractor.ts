/**
 * DOCX text extraction using mammoth
 */

import mammoth from 'mammoth'

interface DOCXExtractResult {
  readonly text: string
  readonly html: string
  readonly messages: readonly string[]
}

export async function extractTextFromDOCX(
  buffer: ArrayBuffer
): Promise<DOCXExtractResult> {
  // Extract as plain text
  const textResult = await mammoth.extractRawText({
    buffer: Buffer.from(buffer),
  })

  // Also extract as HTML for potential rich formatting
  const htmlResult = await mammoth.convertToHtml({
    buffer: Buffer.from(buffer),
  })

  return {
    text: textResult.value,
    html: htmlResult.value,
    messages: textResult.messages.map((m) => m.message),
  }
}

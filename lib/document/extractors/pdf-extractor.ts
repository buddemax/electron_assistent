/**
 * PDF text extraction using pdf2json
 * Pure JavaScript implementation - no canvas dependency
 */

interface PDFExtractResult {
  readonly text: string
  readonly pageCount: number
  readonly metadata: {
    readonly title?: string
    readonly author?: string
    readonly creationDate?: string
  }
}

interface PDFPage {
  readonly Texts?: ReadonlyArray<{
    readonly R?: ReadonlyArray<{
      readonly T?: string
    }>
  }>
}

interface PDFData {
  readonly Pages?: readonly PDFPage[]
  readonly Meta?: {
    readonly Title?: string
    readonly Author?: string
    readonly CreationDate?: string
  }
}

export async function extractTextFromPDF(
  buffer: ArrayBuffer
): Promise<PDFExtractResult> {
  // Dynamic import to avoid SSR issues
  const PDFParser = (await import('pdf2json')).default

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser()

    pdfParser.on('pdfParser_dataReady', (pdfData: PDFData) => {
      const pages = pdfData.Pages ?? []

      // Extract text from all pages
      const textParts: string[] = []
      for (const page of pages) {
        const pageTexts = page.Texts ?? []
        for (const textItem of pageTexts) {
          const runs = textItem.R ?? []
          for (const run of runs) {
            if (run.T) {
              // Decode URI-encoded text
              textParts.push(decodeURIComponent(run.T))
            }
          }
        }
        textParts.push('\n\n') // Page break
      }

      const text = textParts.join(' ').trim()

      resolve({
        text,
        pageCount: pages.length,
        metadata: {
          title: pdfData.Meta?.Title,
          author: pdfData.Meta?.Author,
          creationDate: pdfData.Meta?.CreationDate,
        },
      })
    })

    pdfParser.on('pdfParser_dataError', (errData: Error | { parserError: Error }) => {
      const message = errData instanceof Error
        ? errData.message
        : errData.parserError?.message ?? 'Unknown error'
      reject(new Error(`PDF parsing failed: ${message}`))
    })

    // Parse the buffer
    pdfParser.parseBuffer(Buffer.from(buffer))
  })
}

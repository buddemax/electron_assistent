/**
 * PPTX text extraction
 * Uses JSZip to extract text from PowerPoint XML structure
 */

interface PPTXExtractResult {
  readonly text: string
  readonly slideCount: number
  readonly slideTexts: readonly string[]
}

export async function extractTextFromPPTX(
  buffer: ArrayBuffer
): Promise<PPTXExtractResult> {
  // Dynamic import JSZip
  const JSZip = (await import('jszip')).default

  const zip = await JSZip.loadAsync(buffer)
  const slideTexts: string[] = []

  // Find all slide XML files
  const slideFiles = Object.keys(zip.files)
    .filter((name) => name.match(/ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0')
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0')
      return numA - numB
    })

  for (const slideFile of slideFiles) {
    const content = await zip.files[slideFile].async('string')
    const slideText = extractTextFromSlideXML(content)
    if (slideText.trim()) {
      slideTexts.push(slideText)
    }
  }

  // Also extract from notes if present
  const notesFiles = Object.keys(zip.files).filter((name) =>
    name.match(/ppt\/notesSlides\/notesSlide\d+\.xml$/)
  )

  for (const notesFile of notesFiles) {
    const content = await zip.files[notesFile].async('string')
    const notesText = extractTextFromSlideXML(content)
    if (notesText.trim()) {
      const slideNum = notesFile.match(/notesSlide(\d+)/)?.[1]
      const slideIndex = slideNum ? parseInt(slideNum) - 1 : -1
      if (slideIndex >= 0 && slideIndex < slideTexts.length) {
        slideTexts[slideIndex] += `\n\nNotizen: ${notesText}`
      }
    }
  }

  const fullText = slideTexts
    .map((text, i) => `--- Folie ${i + 1} ---\n${text}`)
    .join('\n\n')

  return {
    text: fullText,
    slideCount: slideFiles.length,
    slideTexts,
  }
}

function extractTextFromSlideXML(xml: string): string {
  // Extract text from <a:t> elements (text runs in PowerPoint XML)
  const textMatches = xml.match(/<a:t>([^<]*)<\/a:t>/g) || []
  const texts = textMatches.map((match) =>
    match.replace(/<\/?a:t>/g, '').trim()
  )

  // Group by paragraphs (rough heuristic based on <a:p> elements)
  const paragraphs: string[] = []
  let currentParagraph = ''

  for (const text of texts) {
    if (text) {
      currentParagraph += (currentParagraph ? ' ' : '') + text
    }
  }

  if (currentParagraph) {
    paragraphs.push(currentParagraph)
  }

  return paragraphs.join('\n')
}

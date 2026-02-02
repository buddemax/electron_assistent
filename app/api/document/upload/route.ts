import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { processDocument } from '@/lib/document/processor'
import type { ApiResponse } from '@/types/api'
import type { DocumentEntry, DocumentFileType } from '@/types/document'
import {
  getDocumentFileType,
  MAX_DOCUMENT_SIZE,
} from '@/types/document'

const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'pptx']

interface UploadResponse {
  document: DocumentEntry
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const mode = formData.get('mode') as 'private' | 'work' | null
    const originalPath = (formData.get('originalPath') as string) || ''

    // Validate file
    if (!file) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'MISSING_FILE',
            message: 'Keine Datei hochgeladen',
          },
        },
        { status: 400 }
      )
    }

    // Validate mode
    if (!mode || !['private', 'work'].includes(mode)) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'INVALID_MODE',
            message: 'Ungültiger Modus',
          },
        },
        { status: 400 }
      )
    }

    // Validate file type
    const fileType = getDocumentFileType(file.name)
    if (!fileType) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: `Ungültiger Dateityp. Unterstützt: ${ACCEPTED_EXTENSIONS.join(', ')}`,
          },
        },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_DOCUMENT_SIZE) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `Datei zu groß. Maximum: ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB`,
          },
        },
        { status: 400 }
      )
    }

    // Get API key
    const apiKey =
      request.headers.get('x-gemini-api-key') || process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: {
            code: 'MISSING_API_KEY',
            message: 'Gemini API Key erforderlich',
          },
        },
        { status: 401 }
      )
    }

    const startTime = Date.now()

    // Process the document
    const result = await processDocument({
      file,
      filename: file.name,
      fileType,
      mode,
      originalPath,
      apiKey,
    })

    const duration = Date.now() - startTime

    return NextResponse.json<ApiResponse<UploadResponse>>({
      success: true,
      data: {
        document: result.document,
      },
      meta: {
        requestId: crypto.randomUUID(),
        duration,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unbekannter Fehler'

    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: {
          code: 'PROCESSING_FAILED',
          message: errorMessage,
        },
      },
      { status: 500 }
    )
  }
}

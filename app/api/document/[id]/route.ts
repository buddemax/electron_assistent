import { NextRequest, NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'
import type { DocumentEntry } from '@/types/document'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/document/[id] - Get document by ID
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params

  // Note: In a real implementation, we'd fetch from a database
  // For this client-side app, documents are stored in Zustand/localStorage
  // This endpoint is mainly for potential future server-side storage

  return NextResponse.json<ApiResponse<{ message: string }>>({
    success: true,
    data: {
      message: `Document ${id} - Fetch from client-side store`,
    },
  })
}

// DELETE /api/document/[id] - Delete document
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const { id } = await params

  // Note: Deletion is handled client-side in the Zustand store
  // This endpoint could be used for server-side cleanup in the future

  return NextResponse.json<ApiResponse<{ deleted: boolean }>>({
    success: true,
    data: {
      deleted: true,
    },
  })
}

/**
 * Meeting Notes Generation API
 * POST /api/meeting-notes
 *
 * Generates structured meeting notes from a transcript using Gemini AI
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateMeetingNotes } from '@/lib/ai/meeting-notes-generator'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { transcript, title, participants, duration, mode } = body

    if (!transcript) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Transcript is required' },
        },
        { status: 400 }
      )
    }

    // Get API key from header or environment
    const apiKey = request.headers.get('x-gemini-api-key') || undefined

    const result = await generateMeetingNotes(
      {
        transcript,
        title,
        participants,
        duration,
        mode,
      },
      apiKey
    )

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: { message: result.error || 'Failed to generate meeting notes' },
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        notes: result.notes,
      },
    })
  } catch (error) {
    console.error('Meeting notes API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      },
      { status: 500 }
    )
  }
}

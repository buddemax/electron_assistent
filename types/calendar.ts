/**
 * Calendar Event Types for VoiceOS
 */

export interface CalendarEvent {
  readonly title: string
  readonly startDate: Date
  readonly endDate: Date
  readonly notes?: string
  readonly location?: string
  readonly allDay?: boolean
  readonly calendarName?: string
}

export interface CalendarEventInput {
  readonly title: string
  readonly date: string // ISO date string or relative ("Freitag", "morgen")
  readonly time: string // "14:00" or "14 Uhr"
  readonly duration: number // Minutes (default: 60)
  readonly notes?: string
  readonly location?: string
  readonly attendees?: readonly string[]
}

export interface CalendarExtractionResult {
  readonly event: CalendarEventInput
  readonly confidence: 'high' | 'medium' | 'low'
  readonly rawInput: string
}

export interface CalendarCreateResult {
  readonly success: boolean
  readonly eventId?: string
  readonly error?: string
}

export interface CalendarOutputStructured {
  readonly event: CalendarEventInput
  readonly formatted: {
    readonly dateDisplay: string // "Freitag, 7. Februar 2025"
    readonly timeDisplay: string // "14:00 - 15:00 Uhr"
    readonly durationDisplay: string // "1 Stunde"
  }
}

/**
 * Export Types
 * Type definitions for meeting protocol export feature
 */

export type MeetingType =
  | 'general'
  | 'standup'
  | 'planning'
  | 'retrospective'
  | 'review'
  | 'workshop'
  | 'interview'
  | 'client-call'
  | 'one-on-one'

export type ExportWizardStep = 'details' | 'participants' | 'agenda' | 'content'

export interface ExportConfig {
  readonly meetingId: string
  readonly title: string
  readonly meetingType: MeetingType
  readonly date: Date
  readonly startTime: Date
  readonly endTime?: Date
  readonly duration: number
  readonly location?: string
  readonly organization?: string
  readonly includeLetterhead: boolean
}

export interface ExportParticipant {
  readonly id: string
  readonly speakerId?: string
  readonly name: string
  readonly role?: string
  readonly email?: string
  readonly isOrganizer?: boolean
}

export interface ExportAgendaItem {
  readonly id: string
  readonly title: string
  readonly order: number
}

export interface ExportContentOptions {
  readonly includeSummary: boolean
  readonly includeKeyPoints: boolean
  readonly includeDecisions: boolean
  readonly includeActionItems: boolean
  readonly includeTopics: boolean
  readonly includeNextSteps: boolean
  readonly includeOpenQuestions: boolean
  readonly includeFullTranscript: boolean
}

export interface ExportState {
  readonly isOpen: boolean
  readonly currentStep: ExportWizardStep
  readonly meetingId: string | null
  readonly config: ExportConfig | null
  readonly participants: readonly ExportParticipant[]
  readonly agenda: readonly ExportAgendaItem[]
  readonly contentOptions: ExportContentOptions
  readonly isExporting: boolean
  readonly exportProgress: number
  readonly exportStage: string
  readonly error: string | null
}

export const DEFAULT_CONTENT_OPTIONS: ExportContentOptions = {
  includeSummary: true,
  includeKeyPoints: true,
  includeDecisions: true,
  includeActionItems: true,
  includeTopics: true,
  includeNextSteps: true,
  includeOpenQuestions: false,
  includeFullTranscript: false,
}

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  general: 'Allgemeines Meeting',
  standup: 'Daily Standup',
  planning: 'Planning Meeting',
  retrospective: 'Retrospektive',
  review: 'Review Meeting',
  workshop: 'Workshop',
  interview: 'Interview',
  'client-call': 'Kundengespräch',
  'one-on-one': '1:1 Meeting',
}

export const WIZARD_STEPS: readonly ExportWizardStep[] = [
  'details',
  'participants',
  'agenda',
  'content',
]

export const WIZARD_STEP_LABELS: Record<ExportWizardStep, string> = {
  details: 'Meeting-Details',
  participants: 'Teilnehmer',
  agenda: 'Agenda',
  content: 'Inhalt',
}

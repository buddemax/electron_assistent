/**
 * Export Store
 * State management for meeting protocol export wizard
 */

import { create } from 'zustand'
import type {
  ExportState,
  ExportWizardStep,
  ExportConfig,
  ExportParticipant,
  ExportAgendaItem,
  ExportContentOptions,
  MeetingType,
} from '@/types/export'
import { DEFAULT_CONTENT_OPTIONS, WIZARD_STEPS } from '@/types/export'
import { useMeetingStore } from './meeting-store'

interface ExportStoreActions {
  // Modal Control
  openExportModal: (meetingId: string) => void
  closeExportModal: () => void

  // Navigation
  setStep: (step: ExportWizardStep) => void
  nextStep: () => void
  previousStep: () => void

  // Config Updates
  updateConfig: (updates: Partial<ExportConfig>) => void

  // Participants
  addParticipant: (participant: Omit<ExportParticipant, 'id'>) => void
  updateParticipant: (id: string, updates: Partial<ExportParticipant>) => void
  removeParticipant: (id: string) => void

  // Agenda
  addAgendaItem: (title: string) => void
  updateAgendaItem: (id: string, updates: Partial<ExportAgendaItem>) => void
  removeAgendaItem: (id: string) => void
  reorderAgendaItems: (items: readonly ExportAgendaItem[]) => void

  // Content Options
  updateContentOptions: (updates: Partial<ExportContentOptions>) => void

  // Export
  startExport: () => void
  setExportProgress: (progress: number, stage: string) => void
  setExportError: (error: string | null) => void
  completeExport: () => void

  // Reset
  reset: () => void
}

const initialState: ExportState = {
  isOpen: false,
  currentStep: 'details',
  meetingId: null,
  config: null,
  participants: [],
  agenda: [],
  contentOptions: DEFAULT_CONTENT_OPTIONS,
  isExporting: false,
  exportProgress: 0,
  exportStage: '',
  error: null,
}

export const useExportStore = create<ExportState & ExportStoreActions>((set, get) => ({
  ...initialState,

  openExportModal: (meetingId: string) => {
    // Get meeting data from meeting store
    const meetingStore = useMeetingStore.getState()
    const meeting = meetingStore.getMeetingById(meetingId)

    if (!meeting) {
      set({ error: 'Meeting nicht gefunden' })
      return
    }

    // Initialize config from meeting data
    const config: ExportConfig = {
      meetingId,
      title: meeting.title || `Meeting vom ${meeting.startedAt.toLocaleDateString('de-DE')}`,
      meetingType: 'general' as MeetingType,
      date: meeting.startedAt,
      startTime: meeting.startedAt,
      endTime: meeting.endedAt ?? undefined,
      duration: meeting.duration,
      location: '',
      organization: '',
      includeLetterhead: false,
    }

    // Initialize participants from detected speakers
    const participants: ExportParticipant[] = meeting.speakers.map((speaker, index) => ({
      id: crypto.randomUUID(),
      speakerId: speaker.id,
      name: speaker.name || speaker.label || `Teilnehmer ${index + 1}`,
      role: '',
      isOrganizer: index === 0,
    }))

    set({
      isOpen: true,
      currentStep: 'details',
      meetingId,
      config,
      participants,
      agenda: [],
      contentOptions: DEFAULT_CONTENT_OPTIONS,
      isExporting: false,
      exportProgress: 0,
      exportStage: '',
      error: null,
    })
  },

  closeExportModal: () => {
    set({ isOpen: false })
  },

  setStep: (step: ExportWizardStep) => {
    set({ currentStep: step })
  },

  nextStep: () => {
    const { currentStep } = get()
    const currentIndex = WIZARD_STEPS.indexOf(currentStep)
    if (currentIndex < WIZARD_STEPS.length - 1) {
      set({ currentStep: WIZARD_STEPS[currentIndex + 1] })
    }
  },

  previousStep: () => {
    const { currentStep } = get()
    const currentIndex = WIZARD_STEPS.indexOf(currentStep)
    if (currentIndex > 0) {
      set({ currentStep: WIZARD_STEPS[currentIndex - 1] })
    }
  },

  updateConfig: (updates: Partial<ExportConfig>) => {
    const { config } = get()
    if (!config) return

    set({
      config: {
        ...config,
        ...updates,
      },
    })
  },

  addParticipant: (participant: Omit<ExportParticipant, 'id'>) => {
    const { participants } = get()
    const newParticipant: ExportParticipant = {
      ...participant,
      id: crypto.randomUUID(),
    }

    set({
      participants: [...participants, newParticipant],
    })
  },

  updateParticipant: (id: string, updates: Partial<ExportParticipant>) => {
    const { participants } = get()

    set({
      participants: participants.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })
  },

  removeParticipant: (id: string) => {
    const { participants } = get()

    set({
      participants: participants.filter((p) => p.id !== id),
    })
  },

  addAgendaItem: (title: string) => {
    const { agenda } = get()
    const newItem: ExportAgendaItem = {
      id: crypto.randomUUID(),
      title,
      order: agenda.length + 1,
    }

    set({
      agenda: [...agenda, newItem],
    })
  },

  updateAgendaItem: (id: string, updates: Partial<ExportAgendaItem>) => {
    const { agenda } = get()

    set({
      agenda: agenda.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })
  },

  removeAgendaItem: (id: string) => {
    const { agenda } = get()

    set({
      agenda: agenda
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, order: index + 1 })),
    })
  },

  reorderAgendaItems: (items: readonly ExportAgendaItem[]) => {
    set({
      agenda: items.map((item, index) => ({ ...item, order: index + 1 })),
    })
  },

  updateContentOptions: (updates: Partial<ExportContentOptions>) => {
    const { contentOptions } = get()

    set({
      contentOptions: {
        ...contentOptions,
        ...updates,
      },
    })
  },

  startExport: () => {
    set({
      isExporting: true,
      exportProgress: 0,
      exportStage: 'Vorbereitung...',
      error: null,
    })
  },

  setExportProgress: (progress: number, stage: string) => {
    set({
      exportProgress: progress,
      exportStage: stage,
    })
  },

  setExportError: (error: string | null) => {
    set({
      error,
      isExporting: false,
    })
  },

  completeExport: () => {
    set({
      isExporting: false,
      exportProgress: 100,
      exportStage: 'Abgeschlossen',
    })
  },

  reset: () => {
    set(initialState)
  },
}))

import { create } from 'zustand'
import type { TranscriptionSegment, Speaker } from '@/types/meeting'
import { getSpeakerColor } from '@/types/meeting'

export interface TranscriptHighlight {
  readonly id: string
  readonly segmentId: string
  readonly type: 'action-item' | 'decision' | 'question' | 'important'
  readonly text: string
  readonly createdAt: Date
}

interface TranscriptState {
  // Segments
  readonly segments: readonly TranscriptionSegment[]
  readonly segmentsByChunk: ReadonlyMap<string, readonly TranscriptionSegment[]>

  // Speakers
  readonly speakers: readonly Speaker[]
  readonly activeSpeakerId: string | null

  // Highlights
  readonly highlights: readonly TranscriptHighlight[]

  // View State
  readonly isAutoScrollEnabled: boolean
  readonly currentTime: number
  readonly searchQuery: string
  readonly filteredSpeakerIds: readonly string[]

  // Actions - Segments
  addSegments: (segments: readonly TranscriptionSegment[]) => void
  addSegment: (segment: TranscriptionSegment) => void
  updateSegment: (id: string, updates: Partial<TranscriptionSegment>) => void
  removeSegmentsByChunk: (chunkId: string) => void

  // Actions - Speakers
  addSpeaker: (speaker: Speaker) => void
  updateSpeaker: (id: string, updates: Partial<Speaker>) => void
  setSpeakers: (speakers: readonly Speaker[]) => void
  setActiveSpeaker: (speakerId: string | null) => void

  // Actions - Highlights
  addHighlight: (highlight: Omit<TranscriptHighlight, 'id' | 'createdAt'>) => void
  removeHighlight: (id: string) => void
  getHighlightsByType: (type: TranscriptHighlight['type']) => readonly TranscriptHighlight[]

  // Actions - View State
  setCurrentTime: (time: number) => void
  setSearchQuery: (query: string) => void
  toggleSpeakerFilter: (speakerId: string) => void
  clearSpeakerFilters: () => void
  setAutoScroll: (enabled: boolean) => void

  // Computed
  getFullTranscript: () => string
  getSegmentsInTimeRange: (startTime: number, endTime: number) => readonly TranscriptionSegment[]
  getSegmentsBySpeaker: (speakerId: string) => readonly TranscriptionSegment[]
  getFilteredSegments: () => readonly TranscriptionSegment[]
  searchSegments: (query: string) => readonly TranscriptionSegment[]

  // Reset
  clearTranscript: () => void
  reset: () => void
}

const initialState = {
  segments: [] as readonly TranscriptionSegment[],
  segmentsByChunk: new Map() as ReadonlyMap<string, readonly TranscriptionSegment[]>,
  speakers: [] as readonly Speaker[],
  activeSpeakerId: null as string | null,
  highlights: [] as readonly TranscriptHighlight[],
  isAutoScrollEnabled: true,
  currentTime: 0,
  searchQuery: '',
  filteredSpeakerIds: [] as readonly string[],
}

export const useTranscriptStore = create<TranscriptState>()((set, get) => ({
  ...initialState,

  addSegments: (newSegments) => {
    set((state) => {
      // Merge and sort segments
      const allSegments = [...state.segments, ...newSegments].sort(
        (a, b) => a.startTime - b.startTime
      )

      // Remove duplicates by ID
      const uniqueSegments = allSegments.filter(
        (seg, index, arr) => arr.findIndex((s) => s.id === seg.id) === index
      )

      // Update chunk index
      const segmentsByChunk = new Map(state.segmentsByChunk)
      for (const segment of newSegments) {
        const existing = segmentsByChunk.get(segment.chunkId) || []
        if (!existing.some((s) => s.id === segment.id)) {
          segmentsByChunk.set(segment.chunkId, [...existing, segment])
        }
      }

      return { segments: uniqueSegments, segmentsByChunk }
    })
  },

  addSegment: (segment) => {
    get().addSegments([segment])
  },

  updateSegment: (id, updates) => {
    set((state) => ({
      segments: state.segments.map((seg) =>
        seg.id === id ? { ...seg, ...updates } : seg
      ),
    }))
  },

  removeSegmentsByChunk: (chunkId) => {
    set((state) => {
      const newSegmentsByChunk = new Map(state.segmentsByChunk)
      newSegmentsByChunk.delete(chunkId)

      return {
        segments: state.segments.filter((seg) => seg.chunkId !== chunkId),
        segmentsByChunk: newSegmentsByChunk,
      }
    })
  },

  addSpeaker: (speaker) => {
    set((state) => {
      // Check if speaker already exists
      if (state.speakers.some((s) => s.id === speaker.id)) {
        return state
      }

      // Assign color if not provided
      const speakerWithColor: Speaker = {
        ...speaker,
        color: speaker.color || getSpeakerColor(state.speakers.length),
      }

      return {
        speakers: [...state.speakers, speakerWithColor],
      }
    })
  },

  updateSpeaker: (id, updates) => {
    set((state) => ({
      speakers: state.speakers.map((sp) =>
        sp.id === id ? { ...sp, ...updates } : sp
      ),
    }))
  },

  setSpeakers: (speakers) => {
    set({ speakers })
  },

  setActiveSpeaker: (speakerId) => {
    set({ activeSpeakerId: speakerId })
  },

  addHighlight: (highlight) => {
    set((state) => ({
      highlights: [
        ...state.highlights,
        {
          ...highlight,
          id: crypto.randomUUID(),
          createdAt: new Date(),
        },
      ],
    }))
  },

  removeHighlight: (id) => {
    set((state) => ({
      highlights: state.highlights.filter((h) => h.id !== id),
    }))
  },

  getHighlightsByType: (type) => {
    return get().highlights.filter((h) => h.type === type)
  },

  setCurrentTime: (currentTime) => {
    set({ currentTime })
  },

  setSearchQuery: (searchQuery) => {
    set({ searchQuery })
  },

  toggleSpeakerFilter: (speakerId) => {
    set((state) => {
      const isFiltered = state.filteredSpeakerIds.includes(speakerId)
      return {
        filteredSpeakerIds: isFiltered
          ? state.filteredSpeakerIds.filter((id) => id !== speakerId)
          : [...state.filteredSpeakerIds, speakerId],
      }
    })
  },

  clearSpeakerFilters: () => {
    set({ filteredSpeakerIds: [] })
  },

  setAutoScroll: (isAutoScrollEnabled) => {
    set({ isAutoScrollEnabled })
  },

  getFullTranscript: () => {
    const { segments, speakers } = get()
    return segments
      .map((seg) => {
        const speaker = speakers.find((s) => s.id === seg.speakerId)
        const speakerLabel = speaker ? `[${speaker.label}]: ` : ''
        return `${speakerLabel}${seg.text}`
      })
      .join('\n\n')
  },

  getSegmentsInTimeRange: (startTime, endTime) => {
    return get().segments.filter(
      (seg) => seg.startTime >= startTime && seg.endTime <= endTime
    )
  },

  getSegmentsBySpeaker: (speakerId) => {
    return get().segments.filter((seg) => seg.speakerId === speakerId)
  },

  getFilteredSegments: () => {
    const { segments, filteredSpeakerIds, searchQuery } = get()

    let filtered = segments

    // Filter by speakers
    if (filteredSpeakerIds.length > 0) {
      filtered = filtered.filter(
        (seg) => seg.speakerId && filteredSpeakerIds.includes(seg.speakerId)
      )
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((seg) =>
        seg.text.toLowerCase().includes(query)
      )
    }

    return filtered
  },

  searchSegments: (query) => {
    if (!query.trim()) return get().segments

    const lowerQuery = query.toLowerCase()
    return get().segments.filter((seg) =>
      seg.text.toLowerCase().includes(lowerQuery)
    )
  },

  clearTranscript: () => {
    set({
      segments: [],
      segmentsByChunk: new Map(),
      speakers: [],
      highlights: [],
      currentTime: 0,
      activeSpeakerId: null,
    })
  },

  reset: () => {
    set(initialState)
  },
}))

// Selectors
export const selectSegments = (state: TranscriptState) => state.segments
export const selectSpeakers = (state: TranscriptState) => state.speakers
export const selectHighlights = (state: TranscriptState) => state.highlights
export const selectIsAutoScrollEnabled = (state: TranscriptState) =>
  state.isAutoScrollEnabled
export const selectCurrentTime = (state: TranscriptState) => state.currentTime
export const selectSearchQuery = (state: TranscriptState) => state.searchQuery
export const selectFilteredSpeakerIds = (state: TranscriptState) =>
  state.filteredSpeakerIds

// Helper to group consecutive segments by speaker
export function groupSegmentsBySpeaker(
  segments: readonly TranscriptionSegment[]
): readonly {
  speakerId: string | undefined
  segments: readonly TranscriptionSegment[]
}[] {
  if (segments.length === 0) return []

  const groups: {
    speakerId: string | undefined
    segments: TranscriptionSegment[]
  }[] = []

  let currentGroup: {
    speakerId: string | undefined
    segments: TranscriptionSegment[]
  } | null = null

  for (const segment of segments) {
    if (!currentGroup || currentGroup.speakerId !== segment.speakerId) {
      currentGroup = {
        speakerId: segment.speakerId,
        segments: [segment],
      }
      groups.push(currentGroup)
    } else {
      currentGroup.segments.push(segment)
    }
  }

  return groups
}

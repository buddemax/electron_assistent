import { create } from 'zustand'
import type {
  KnowledgeEntry,
  KnowledgeSearchResult,
  SmartSuggestion,
  KnowledgeStats,
  KnowledgeFilter,
} from '@/types/knowledge'
import type { Mode } from '@/types/output'
import type { GraphNode, GraphEdge, GraphState } from '@/types/graph'

interface KnowledgeState {
  // Knowledge Entries (cached)
  entries: readonly KnowledgeEntry[]
  entriesByMode: {
    private: readonly KnowledgeEntry[]
    work: readonly KnowledgeEntry[]
  }

  // Search
  searchResults: readonly KnowledgeSearchResult[]
  isSearching: boolean
  searchQuery: string

  // Smart Suggestions
  suggestions: readonly SmartSuggestion[]
  isFetchingSuggestions: boolean

  // Graph State
  graph: GraphState

  // Stats
  stats: KnowledgeStats | null

  // Actions
  setEntries: (entries: readonly KnowledgeEntry[]) => void
  addEntry: (entry: KnowledgeEntry) => void
  updateEntry: (id: string, updates: Partial<KnowledgeEntry>) => void
  removeEntry: (id: string) => void

  setSearchResults: (results: readonly KnowledgeSearchResult[]) => void
  setIsSearching: (isSearching: boolean) => void
  setSearchQuery: (query: string) => void

  setSuggestions: (suggestions: readonly SmartSuggestion[]) => void
  setIsFetchingSuggestions: (isFetching: boolean) => void
  clearSuggestions: () => void

  setGraph: (graph: Partial<GraphState>) => void
  addGraphNode: (node: GraphNode) => void
  addGraphEdge: (edge: GraphEdge) => void
  highlightNode: (nodeId: string) => void
  clearHighlights: () => void

  setStats: (stats: KnowledgeStats | null) => void

  // Filters
  getEntriesByMode: (mode: Mode) => readonly KnowledgeEntry[]
  getFilteredEntries: (filter: KnowledgeFilter) => readonly KnowledgeEntry[]

  reset: () => void
}

const initialGraphState: GraphState = {
  nodes: [],
  edges: [],
  focusedNodeId: null,
  selectedNodeIds: [],
  visibleModes: ['private', 'work'],
  zoom: 1,
  position: { x: 0, y: 0 },
}

const initialState = {
  entries: [] as readonly KnowledgeEntry[],
  entriesByMode: {
    private: [] as readonly KnowledgeEntry[],
    work: [] as readonly KnowledgeEntry[],
  },
  searchResults: [] as readonly KnowledgeSearchResult[],
  isSearching: false,
  searchQuery: '',
  suggestions: [] as readonly SmartSuggestion[],
  isFetchingSuggestions: false,
  graph: initialGraphState,
  stats: null,
}

export const useKnowledgeStore = create<KnowledgeState>()((set, get) => ({
  ...initialState,

  setEntries: (entries) => {
    const privateEntries = entries.filter((e) => e.mode === 'private')
    const workEntries = entries.filter((e) => e.mode === 'work')
    set({
      entries,
      entriesByMode: {
        private: privateEntries,
        work: workEntries,
      },
    })
  },

  addEntry: (entry) =>
    set((state) => {
      const newEntries = [...state.entries, entry]
      const modeKey = entry.mode
      return {
        entries: newEntries,
        entriesByMode: {
          ...state.entriesByMode,
          [modeKey]: [...state.entriesByMode[modeKey], entry],
        },
      }
    }),

  updateEntry: (id, updates) =>
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: new Date() } : e
      ),
    })),

  removeEntry: (id) =>
    set((state) => {
      const entry = state.entries.find((e) => e.id === id)
      if (!entry) return state

      const newEntries = state.entries.filter((e) => e.id !== id)
      const modeKey = entry.mode
      return {
        entries: newEntries,
        entriesByMode: {
          ...state.entriesByMode,
          [modeKey]: state.entriesByMode[modeKey].filter((e) => e.id !== id),
        },
      }
    }),

  setSearchResults: (searchResults) => set({ searchResults }),
  setIsSearching: (isSearching) => set({ isSearching }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setSuggestions: (suggestions) => set({ suggestions }),
  setIsFetchingSuggestions: (isFetchingSuggestions) =>
    set({ isFetchingSuggestions }),
  clearSuggestions: () => set({ suggestions: [] }),

  setGraph: (graphUpdates) =>
    set((state) => ({
      graph: { ...state.graph, ...graphUpdates },
    })),

  addGraphNode: (node) =>
    set((state) => ({
      graph: {
        ...state.graph,
        nodes: [...state.graph.nodes, node],
      },
    })),

  addGraphEdge: (edge) =>
    set((state) => ({
      graph: {
        ...state.graph,
        edges: [...state.graph.edges, edge],
      },
    })),

  highlightNode: (nodeId) =>
    set((state) => ({
      graph: {
        ...state.graph,
        focusedNodeId: nodeId,
        nodes: state.graph.nodes.map((n) => ({
          ...n,
          data: {
            ...n.data,
            isHighlighted: n.id === nodeId,
          },
        })),
      },
    })),

  clearHighlights: () =>
    set((state) => ({
      graph: {
        ...state.graph,
        focusedNodeId: null,
        nodes: state.graph.nodes.map((n) => ({
          ...n,
          data: {
            ...n.data,
            isHighlighted: false,
          },
        })),
      },
    })),

  setStats: (stats) => set({ stats }),

  getEntriesByMode: (mode) => get().entriesByMode[mode],

  getFilteredEntries: (filter) => {
    const { entries } = get()
    return entries.filter((entry) => {
      if (filter.mode && entry.mode !== filter.mode) return false
      if (
        filter.entityTypes &&
        entry.metadata.entityType &&
        !filter.entityTypes.includes(entry.metadata.entityType)
      )
        return false
      if (
        filter.tags &&
        !filter.tags.some((tag) => entry.metadata.tags.includes(tag))
      )
        return false
      if (
        filter.minRelevance &&
        entry.metadata.relevanceDecay < filter.minRelevance
      )
        return false
      if (filter.createdAfter && entry.createdAt < filter.createdAfter)
        return false
      if (filter.createdBefore && entry.createdAt > filter.createdBefore)
        return false
      return true
    })
  },

  reset: () => set(initialState),
}))

// Selectors
export const selectSuggestions = (state: KnowledgeState) => state.suggestions
export const selectGraphNodes = (state: KnowledgeState) => state.graph.nodes
export const selectGraphEdges = (state: KnowledgeState) => state.graph.edges

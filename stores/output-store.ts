import { create } from 'zustand'
import type {
  GeneratedOutput,
  OutputType,
  OutputVariant,
  Mode,
} from '@/types/output'
import type { KnowledgeReference } from '@/types/knowledge'
import type { UserProfile, OutputLength } from '@/types/profile'
import type { Intent } from '@/lib/context/intent-detector'
import type { Conversation } from '@/types/conversation'
import type { QuestionAnswer } from '@/types/daily-questions'

// Map profile's OutputLength to OutputVariant
function mapOutputLengthToVariant(length: OutputLength): OutputVariant {
  switch (length) {
    case 'concise':
      return 'short'
    case 'balanced':
      return 'standard'
    case 'detailed':
      return 'detailed'
    default:
      return 'standard'
  }
}

interface ContextState {
  context: readonly KnowledgeReference[]
  intent: Intent | null
  conversationContext?: string
}

interface OutputState {
  // Current Output
  currentOutput: GeneratedOutput | null
  outputVariants: {
    short: GeneratedOutput | null
    standard: GeneratedOutput | null
    detailed: GeneratedOutput | null
  }
  selectedVariant: OutputVariant
  detectedType: OutputType | null

  // Context State
  contextState: ContextState

  // Generation State
  isGenerating: boolean
  isGeneratingVariant: boolean
  generationProgress: number
  abortController: AbortController | null

  // Store original request for on-demand variant generation
  lastRequest: {
    transcription: string
    mode: Mode
    profile?: UserProfile
    conversationContext?: string
    dailyQuestionsAnswers?: readonly QuestionAnswer[]
  } | null

  // History
  outputHistory: readonly GeneratedOutput[]

  // Actions
  setCurrentOutput: (output: GeneratedOutput | null) => void
  setOutputVariants: (variants: {
    short: GeneratedOutput | null
    standard: GeneratedOutput | null
    detailed: GeneratedOutput | null
  }) => void
  setSelectedVariant: (variant: OutputVariant) => void
  setDetectedType: (type: OutputType | null) => void
  setContextState: (state: Partial<ContextState>) => void
  setIsGenerating: (isGenerating: boolean) => void
  setGenerationProgress: (progress: number) => void
  addToHistory: (output: GeneratedOutput) => void
  clearHistory: () => void
  reset: () => void
  generateOutput: (transcription: string, mode?: Mode, context?: readonly KnowledgeReference[], profile?: UserProfile, conversationContext?: string, dailyQuestionsAnswers?: readonly QuestionAnswer[]) => Promise<void>
  generateVariant: (variant: OutputVariant) => Promise<void>
  fetchContext: (query: string, mode: Mode, entries: readonly import('@/types/knowledge').KnowledgeEntry[], documents?: readonly import('@/types/document').DocumentEntry[], conversation?: Conversation | null) => Promise<ContextState>
  cancelGeneration: () => void
}

const initialContextState: ContextState = {
  context: [],
  intent: null,
}

const initialState = {
  currentOutput: null,
  outputVariants: {
    short: null,
    standard: null,
    detailed: null,
  },
  selectedVariant: 'standard' as OutputVariant,
  detectedType: null,
  contextState: initialContextState,
  isGenerating: false,
  isGeneratingVariant: false,
  generationProgress: 0,
  abortController: null as AbortController | null,
  lastRequest: null as OutputState['lastRequest'],
  outputHistory: [] as readonly GeneratedOutput[],
}

export const useOutputStore = create<OutputState>()((set, get) => ({
  ...initialState,

  setCurrentOutput: (currentOutput) => set({ currentOutput }),

  setOutputVariants: (outputVariants) =>
    set((state) => ({
      outputVariants,
      currentOutput: outputVariants[state.selectedVariant],
    })),

  setSelectedVariant: (selectedVariant) => {
    const state = get()
    const existingVariant = state.outputVariants[selectedVariant]

    if (existingVariant) {
      // Variant exists, just select it
      set({
        selectedVariant,
        currentOutput: existingVariant,
      })
    } else if (state.lastRequest && !state.isGeneratingVariant) {
      // Variant doesn't exist, trigger on-demand generation
      set({ selectedVariant })
      get().generateVariant(selectedVariant).catch((err) => {
        // Error is handled in generateVariant, just log it
        console.error('Failed to generate variant:', err)
      })
    } else {
      // No lastRequest or already generating, just set the selected variant
      set({ selectedVariant })
    }
  },

  setDetectedType: (detectedType) => set({ detectedType }),

  setContextState: (updates) =>
    set((state) => ({
      contextState: { ...state.contextState, ...updates },
    })),

  setIsGenerating: (isGenerating) =>
    set({
      isGenerating,
      generationProgress: isGenerating ? 0 : 100,
    }),

  setGenerationProgress: (generationProgress) => set({ generationProgress }),

  addToHistory: (output) =>
    set((state) => ({
      outputHistory: [output, ...state.outputHistory].slice(0, 50), // Keep last 50
    })),

  clearHistory: () => set({ outputHistory: [] }),

  reset: () =>
    set({
      currentOutput: null,
      outputVariants: {
        short: null,
        standard: null,
        detailed: null,
      },
      detectedType: null,
      contextState: initialContextState,
      isGenerating: false,
      isGeneratingVariant: false,
      generationProgress: 0,
      abortController: null,
      lastRequest: null,
    }),

  fetchContext: async (
    query: string,
    mode: Mode,
    entries: readonly import('@/types/knowledge').KnowledgeEntry[],
    documents: readonly import('@/types/document').DocumentEntry[] = [],
    conversation: Conversation | null = null
  ) => {
    // Import context functions dynamically to avoid circular dependencies
    const { detectIntent, requiresContextRetrieval } = await import('@/lib/context/intent-detector')
    const { assembleContext } = await import('@/lib/context/unified-context')

    const intentResult = detectIntent(query)

    // For follow-up questions in a conversation, we may still want context
    const hasActiveConversation = conversation && conversation.messages.length > 0

    if (!requiresContextRetrieval(intentResult.intent) && !hasActiveConversation) {
      return {
        context: [],
        intent: intentResult.intent,
        conversationContext: undefined,
      }
    }

    // Use unified context assembly to fetch from knowledge base, documents, AND conversation
    const result = await assembleContext(
      {
        query,
        mode,
        intent: intentResult.intent,
        knowledgeLimit: 5,
        documentLimit: 3,
        conversation,
      },
      entries,
      documents
    )

    const contextState: ContextState = {
      context: result.references,
      intent: intentResult.intent,
      conversationContext: result.conversationContext,
    }

    set({ contextState })
    return contextState
  },

  generateOutput: async (transcription: string, mode: Mode = 'work', providedContext?: readonly KnowledgeReference[], profile?: UserProfile, conversationContext?: string, dailyQuestionsAnswers?: readonly QuestionAnswer[]) => {
    const abortController = new AbortController()
    set({ isGenerating: true, generationProgress: 0, abortController })

    try {
      // Use provided context or context from state
      const context = providedContext ?? get().contextState.context
      // Use provided conversation context or from state
      const convContext = conversationContext ?? get().contextState.conversationContext

      // Determine variant from profile's preferredOutputLength
      const preferredVariant = profile?.preferredOutputLength
        ? mapOutputLengthToVariant(profile.preferredOutputLength)
        : get().selectedVariant

      // Store request for later on-demand variant generation
      set({
        lastRequest: {
          transcription,
          mode,
          profile,
          conversationContext: convContext,
          dailyQuestionsAnswers,
        },
      })

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription,
          mode,
          variant: preferredVariant,
          singleVariant: true, // Only generate the preferred variant
          context: context.length > 0 ? context : undefined,
          profile,
          conversationContext: convContext,
          dailyQuestionsAnswers: dailyQuestionsAnswers?.map((a) => ({
            ...a,
            answeredAt: a.answeredAt.toISOString(),
          })),
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Generation fehlgeschlagen')
      }

      const result = await response.json()

      if (result.success && result.data?.outputs) {
        const outputs = result.data.outputs as {
          short: GeneratedOutput | null
          standard: GeneratedOutput | null
          detailed: GeneratedOutput | null
        }
        // Use the preferred variant from profile
        const currentOutput = outputs[preferredVariant]

        if (!currentOutput) {
          throw new Error('Generierte Variante nicht gefunden')
        }

        set({
          outputVariants: outputs,
          currentOutput,
          selectedVariant: preferredVariant,
          detectedType: result.data.detectedType || currentOutput.type,
          isGenerating: false,
          generationProgress: 100,
        })
        get().addToHistory(currentOutput)
      } else {
        throw new Error(result.error?.message || 'Keine Ausgabe erhalten')
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        set({ isGenerating: false, generationProgress: 0 })
        return
      }
      set({ isGenerating: false, generationProgress: 0 })
      throw err
    } finally {
      set({ abortController: null })
    }
  },

  generateVariant: async (variant: OutputVariant) => {
    const { lastRequest, outputVariants, contextState } = get()

    // If variant already exists, just select it
    if (outputVariants[variant]) {
      set({
        selectedVariant: variant,
        currentOutput: outputVariants[variant],
      })
      return
    }

    // Need lastRequest to generate a new variant
    if (!lastRequest) {
      throw new Error('Keine vorherige Anfrage zum Generieren einer Variante')
    }

    set({ isGeneratingVariant: true })

    try {
      const context = contextState.context

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription: lastRequest.transcription,
          mode: lastRequest.mode,
          variant,
          singleVariant: true,
          context: context.length > 0 ? context : undefined,
          profile: lastRequest.profile,
          conversationContext: lastRequest.conversationContext,
          dailyQuestionsAnswers: lastRequest.dailyQuestionsAnswers?.map((a) => ({
            ...a,
            answeredAt: a.answeredAt.toISOString(),
          })),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Varianten-Generierung fehlgeschlagen')
      }

      const result = await response.json()

      if (result.success && result.data?.outputs) {
        const generatedOutput = result.data.outputs[variant] as GeneratedOutput | null

        if (!generatedOutput) {
          throw new Error('Generierte Variante nicht gefunden')
        }

        // Update the variants with the newly generated one
        set((state) => ({
          outputVariants: {
            ...state.outputVariants,
            [variant]: generatedOutput,
          },
          currentOutput: generatedOutput,
          selectedVariant: variant,
          isGeneratingVariant: false,
        }))
      } else {
        throw new Error(result.error?.message || 'Keine Ausgabe erhalten')
      }
    } catch (err) {
      set({ isGeneratingVariant: false })
      throw err
    }
  },

  cancelGeneration: () => {
    const { abortController } = get()
    if (abortController) {
      abortController.abort()
    }
    set({ isGenerating: false, generationProgress: 0, abortController: null })
  },
}))

// Selectors
export const selectCurrentOutput = (state: OutputState) => state.currentOutput
export const selectIsGenerating = (state: OutputState) => state.isGenerating
export const selectIsGeneratingVariant = (state: OutputState) => state.isGeneratingVariant
export const selectOutputByVariant = (variant: OutputVariant) => (state: OutputState) =>
  state.outputVariants[variant]

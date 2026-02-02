import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Mode } from '@/types/output'
import type {
  Conversation,
  ConversationMessage,
  SerializedConversation,
} from '@/types/conversation'
import {
  serializeConversation,
  deserializeConversation,
  generateConversationTitle,
} from '@/types/conversation'

interface ConversationState {
  // Conversations
  conversations: readonly Conversation[]
  activeConversationId: string | null

  // Actions
  createConversation: (mode: Mode, initialMessage: string) => Conversation
  addMessage: (
    conversationId: string,
    message: Omit<ConversationMessage, 'id' | 'timestamp'>
  ) => void
  setActiveConversation: (conversationId: string | null) => void
  deactivateAllConversations: () => void
  getActiveConversation: () => Conversation | null
  getConversationById: (id: string) => Conversation | null
  getConversationsByMode: (mode: Mode) => readonly Conversation[]
  getRecentMessages: (
    conversationId: string,
    limit?: number
  ) => readonly ConversationMessage[]
  deleteConversation: (id: string) => void
  clearAllConversations: () => void

  // Follow-up detection
  isContinuation: (text: string) => boolean

  reset: () => void
}

// Patterns that indicate a follow-up question
const CONTINUATION_PATTERNS = [
  // Starting with conjunctions
  /^und\s/i,
  /^auch\s/i,
  /^aber\s/i,
  /^oder\s/i,

  // Reference to previous content
  /^was\s+(ist|sind|war|waren)\s+(damit|davon|das)/i,
  /^wie\s+(war|ist|meinst)\s+(das|du)/i,
  /^kannst\s+du\s+(das\s+)?(noch|mehr|genauer)/i,
  /^k[oö]nn(t)?est\s+du/i,

  // Asking for more/clarification
  /^erkl[aä]r\s+(mir\s+)?(das|mehr|genauer)/i,
  /^mehr\s+(dazu|davon|details)/i,
  /^genauer/i,
  /^detail(liert)?er/i,

  // Follow-up questions
  /^und\s+was\s+(ist|war|sind|waren)\s+mit/i,
  /^noch\s+(eine\s+)?(frage|was)/i,
  /^dazu\s+(noch|eine)/i,
  /^bez[uü]glich\s+(dessen|dem|dazu)/i,
  /^was\s+meinst\s+du\s+(damit|dazu)/i,
  /^warum\s+(ist|war|sind|waren)\s+(das|die|der)\s+so/i,

  // Negative/questioning previous answer
  /^war(en)?\s+(da\s+)?(keine|nicht|wirklich)/i,
  /^gibt\s+(es\s+)?(noch|keine|weitere)/i,
  /^sonst\s+(noch|nichts|keine)/i,
  /^keine\s+weiteren/i,
  /^nichts\s+(weiter|mehr|anderes)/i,
  /^stimmt\s+das/i,
  /^bist\s+du\s+sicher/i,
  /^wirklich\s+(nur|keine|nicht)/i,

  // Confirmation seeking
  /^ok(ay)?,?\s+(und|aber|was|also)/i,
  /^verstehe,?\s+(und|aber|was|also)/i,
  /^aha,?\s+(und|aber|was|also)/i,
  /^gut,?\s+(und|aber|was|also)/i,
  /^alles\s+klar,?\s+(und|aber|was)/i,

  // Pronouns referencing previous content (short questions)
  /^(das|die|der|davon|dazu|dar[uü]ber|damit)\s/i,
  /^wer\s+(noch|sonst|war\s+das)/i,
  /^was\s+(noch|sonst|genau)/i,

  // Direct references
  /^nochmal/i,
  /^wiederhol/i,
  /^zusammenfass/i,
]

// Words that suggest reference to previous context
const REFERENCE_WORDS = new Set([
  'das', 'die', 'der', 'davon', 'dazu', 'darüber', 'damit', 'dessen',
  'diese', 'dieser', 'dieses', 'jene', 'welche', 'solche',
  'vorher', 'oben', 'erwähnt', 'genannt', 'gesagt', 'gemeint',
])

const MAX_CONVERSATIONS = 50
const MAX_MESSAGES_PER_CONVERSATION = 100

const initialState = {
  conversations: [] as readonly Conversation[],
  activeConversationId: null as string | null,
}

export const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      createConversation: (mode, initialMessage) => {
        const now = new Date()
        const newConversation: Conversation = {
          id: crypto.randomUUID(),
          title: generateConversationTitle(initialMessage),
          mode,
          messages: [],
          createdAt: now,
          updatedAt: now,
          isActive: true,
        }

        set((state) => {
          // Deactivate all other conversations
          const updatedConversations = state.conversations.map((c) => ({
            ...c,
            isActive: false,
          }))

          // Keep max MAX_CONVERSATIONS
          const trimmed = [newConversation, ...updatedConversations].slice(
            0,
            MAX_CONVERSATIONS
          )

          return {
            conversations: trimmed,
            activeConversationId: newConversation.id,
          }
        })

        return newConversation
      },

      addMessage: (conversationId, message) =>
        set((state) => {
          const now = new Date()
          const newMessage: ConversationMessage = {
            ...message,
            id: crypto.randomUUID(),
            timestamp: now,
          }

          return {
            conversations: state.conversations.map((conv) =>
              conv.id === conversationId
                ? {
                    ...conv,
                    messages: [...conv.messages, newMessage].slice(
                      -MAX_MESSAGES_PER_CONVERSATION
                    ),
                    updatedAt: now,
                  }
                : conv
            ),
          }
        }),

      setActiveConversation: (conversationId) =>
        set((state) => ({
          activeConversationId: conversationId,
          conversations: state.conversations.map((c) => ({
            ...c,
            isActive: c.id === conversationId,
          })),
        })),

      deactivateAllConversations: () =>
        set((state) => ({
          activeConversationId: null,
          conversations: state.conversations.map((c) => ({
            ...c,
            isActive: false,
          })),
        })),

      getActiveConversation: () => {
        const { conversations, activeConversationId } = get()
        if (!activeConversationId) return null
        return conversations.find((c) => c.id === activeConversationId) ?? null
      },

      getConversationById: (id) =>
        get().conversations.find((c) => c.id === id) ?? null,

      getConversationsByMode: (mode) =>
        get().conversations.filter((c) => c.mode === mode),

      getRecentMessages: (conversationId, limit = 10) => {
        const conversation = get().getConversationById(conversationId)
        if (!conversation) return []
        return conversation.messages.slice(-limit)
      },

      deleteConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          activeConversationId:
            state.activeConversationId === id
              ? null
              : state.activeConversationId,
        })),

      clearAllConversations: () =>
        set({
          conversations: [],
          activeConversationId: null,
        }),

      isContinuation: (text) => {
        const { conversations, activeConversationId } = get()

        // If there's an active conversation that was updated recently (within 5 minutes),
        // always treat as continuation to preserve conversation flow
        if (activeConversationId) {
          const activeConv = conversations.find(c => c.id === activeConversationId)
          if (activeConv) {
            const timeSinceUpdate = Date.now() - activeConv.updatedAt.getTime()
            const fiveMinutes = 5 * 60 * 1000
            if (timeSinceUpdate < fiveMinutes) {
              return true
            }
          }
        }

        const trimmed = text.trim().toLowerCase()
        const words = trimmed.split(/\s+/)

        // Check explicit continuation patterns
        if (CONTINUATION_PATTERNS.some((pattern) => pattern.test(trimmed))) {
          return true
        }

        // Short questions (≤8 words) with reference words are likely follow-ups
        if (words.length <= 8) {
          const hasReferenceWord = words.some(word => REFERENCE_WORDS.has(word))
          if (hasReferenceWord) {
            return true
          }
        }

        return false
      },

      reset: () => set(initialState),
    }),
    {
      name: 'voiceos-conversation-store',
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null

          const parsed = JSON.parse(str)
          if (parsed.state?.conversations) {
            parsed.state.conversations = (
              parsed.state.conversations as SerializedConversation[]
            ).map(deserializeConversation)
          }
          return parsed
        },
        setItem: (name, value) => {
          const toStore = {
            ...value,
            state: {
              ...value.state,
              conversations: (value.state.conversations as Conversation[]).map(
                serializeConversation
              ),
            },
          }
          localStorage.setItem(name, JSON.stringify(toStore))
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)

// Selectors
export const selectActiveConversation = (state: ConversationState) =>
  state.conversations.find((c) => c.id === state.activeConversationId) ?? null

export const selectConversationCount = (state: ConversationState) =>
  state.conversations.length

export const selectHasActiveConversation = (state: ConversationState) =>
  state.activeConversationId !== null

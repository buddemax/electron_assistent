'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageBubble } from './message-bubble'
import {
  useConversationStore,
  selectActiveConversation,
} from '@/stores/conversation-store'

interface ConversationHistoryProps {
  className?: string
}

export function ConversationHistory({ className = '' }: ConversationHistoryProps) {
  const activeConversation = useConversationStore(selectActiveConversation)
  const clearAllConversations = useConversationStore((s) => s.clearAllConversations)
  const deactivateAllConversations = useConversationStore((s) => s.deactivateAllConversations)

  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isAutoScrollEnabled && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeConversation?.messages, isAutoScrollEnabled])

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!containerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50

    if (isAtBottom !== isAutoScrollEnabled) {
      setIsAutoScrollEnabled(isAtBottom)
    }
  }

  const handleClear = () => {
    // Only clear when user explicitly clicks - deactivates current conversation
    // so a new one will be created on next voice input
    deactivateAllConversations()
  }

  const messages = activeConversation?.messages ?? []
  const hasMessages = messages.length > 0

  return (
    <div className={`flex flex-col h-full bg-[var(--bg-primary)] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <ChatIcon className="w-4 h-4 text-[var(--text-muted)]" />
          <h3 className="text-xs font-medium text-[var(--text-secondary)]">
            Verlauf
          </h3>
          {hasMessages && (
            <span className="text-[10px] text-[var(--text-muted)]">
              ({messages.length})
            </span>
          )}
        </div>
        {hasMessages && (
          <button
            onClick={handleClear}
            className="text-[10px] px-2 py-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            Leeren
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-3"
      >
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              isLast={index === messages.length - 1}
            />
          ))}
        </AnimatePresence>

        {/* Empty state */}
        {!hasMessages && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-3">
              <ChatIcon className="w-6 h-6 text-[var(--text-muted)]" />
            </div>
            <p className="text-[var(--text-secondary)] text-xs font-medium mb-1">
              Kein Verlauf
            </p>
            <p className="text-[var(--text-muted)] text-[10px] max-w-[140px]">
              Deine Unterhaltung erscheint hier
            </p>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Auto-scroll indicator */}
      {hasMessages && !isAutoScrollEnabled && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          onClick={() => {
            setIsAutoScrollEnabled(true)
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          }}
          className="absolute bottom-16 right-3 px-2 py-1 rounded-full bg-[var(--accent)] text-white text-[10px] shadow-lg flex items-center gap-1"
        >
          <ArrowDownIcon className="w-3 h-3" />
          Neueste
        </motion.button>
      )}
    </div>
  )
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
      />
    </svg>
  )
}

function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  )
}

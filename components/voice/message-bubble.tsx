'use client'

import { motion } from 'framer-motion'
import type { ConversationMessage } from '@/types/conversation'

interface MessageBubbleProps {
  message: ConversationMessage
  isLast?: boolean
}

/**
 * Format timestamp as HH:MM
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MessageBubble({ message, isLast = false }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`
          max-w-[85%] px-3 py-2 rounded-2xl
          ${isUser
            ? 'bg-[var(--accent)] text-white rounded-br-md'
            : 'bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-bl-md'
          }
        `}
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
        </p>
        <span
          className={`
            text-[10px] mt-1 block
            ${isUser ? 'text-white/70' : 'text-[var(--text-muted)]'}
          `}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>
    </motion.div>
  )
}

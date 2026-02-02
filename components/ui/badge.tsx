'use client'

import type { HTMLAttributes } from 'react'

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'error' | 'outline'
type BadgeSize = 'sm' | 'md'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
  accent: 'bg-[var(--accent-subtle)] text-[var(--accent)]',
  success: 'bg-[var(--success-subtle)] text-[var(--success)]',
  warning: 'bg-[var(--warning-subtle)] text-[var(--warning)]',
  error: 'bg-[var(--error-subtle)] text-[var(--error)]',
  outline: 'bg-transparent border border-[var(--border)] text-[var(--text-secondary)]',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-1',
}

export function Badge({
  variant = 'default',
  size = 'md',
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center justify-center
        font-medium rounded-[var(--radius-sm)]
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  )
}

// Output type badges with specific colors
type OutputTypeBadgeProps = {
  type: 'email' | 'meeting-note' | 'todo' | 'note' | 'question' | 'brainstorm' | 'summary' | 'calendar' | 'general'
}

const outputTypeLabels: Record<OutputTypeBadgeProps['type'], string> = {
  email: 'E-Mail',
  'meeting-note': 'Meeting',
  todo: 'Aufgabe',
  note: 'Notiz',
  question: 'Frage',
  brainstorm: 'Idee',
  summary: 'Summary',
  calendar: 'Termin',
  general: 'Allgemein',
}

const outputTypeColors: Record<OutputTypeBadgeProps['type'], string> = {
  email: 'bg-blue-500/15 text-blue-400',
  'meeting-note': 'bg-purple-500/15 text-purple-400',
  todo: 'bg-green-500/15 text-green-400',
  note: 'bg-indigo-500/15 text-indigo-400',
  question: 'bg-amber-500/15 text-amber-400',
  brainstorm: 'bg-pink-500/15 text-pink-400',
  summary: 'bg-cyan-500/15 text-cyan-400',
  calendar: 'bg-teal-500/15 text-teal-400',
  general: 'bg-gray-500/15 text-gray-400',
}

export function OutputTypeBadge({ type }: OutputTypeBadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center justify-center
        text-xs font-medium px-2 py-1
        rounded-[var(--radius-sm)]
        ${outputTypeColors[type]}
      `}
    >
      {outputTypeLabels[type]}
    </span>
  )
}

'use client'

import { motion } from 'framer-motion'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  label?: string
}

const sizeStyles = {
  sm: {
    track: 'w-8 h-5',
    thumb: 'w-3.5 h-3.5',
    translate: 14,
  },
  md: {
    track: 'w-11 h-6',
    thumb: 'w-4 h-4',
    translate: 20,
  },
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  label,
}: ToggleProps) {
  const styles = sizeStyles[size]

  return (
    <label className="inline-flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex items-center
          ${styles.track}
          rounded-full
          transition-colors duration-[var(--transition-fast)]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]
          disabled:opacity-50 disabled:cursor-not-allowed
          ${checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-elevated)] border border-[var(--border)]'}
        `}
      >
        <motion.span
          className={`
            ${styles.thumb}
            rounded-full bg-white shadow-sm
            absolute left-1
          `}
          animate={{
            x: checked ? styles.translate : 0,
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
        />
      </button>
      {label && (
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      )}
    </label>
  )
}

// Mode Toggle for Private/Work
interface ModeToggleProps {
  mode: 'private' | 'work'
  onChange: (mode: 'private' | 'work') => void
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] rounded-[var(--radius-md)] border border-[var(--border)]">
      <button
        onClick={() => onChange('private')}
        className={`
          px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)]
          transition-all duration-[var(--transition-fast)]
          ${
            mode === 'private'
              ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }
        `}
      >
        Privat
      </button>
      <button
        onClick={() => onChange('work')}
        className={`
          px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)]
          transition-all duration-[var(--transition-fast)]
          ${
            mode === 'work'
              ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }
        `}
      >
        Beruflich
      </button>
    </div>
  )
}

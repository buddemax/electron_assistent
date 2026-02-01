'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOutputStore } from '@/stores/output-store'
import { OutputTypeBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { OutputVariant } from '@/types/output'

export function OutputPanel() {
  const {
    currentOutput,
    outputVariants,
    selectedVariant,
    detectedType,
    isGenerating,
    setSelectedVariant,
    contextState,
  } = useOutputStore()

  const [copied, setCopied] = useState(false)

  const variants: OutputVariant[] = ['short', 'standard', 'detailed']
  const variantLabels: Record<OutputVariant, string> = {
    short: 'Kurz',
    standard: 'Standard',
    detailed: 'Ausführlich',
  }

  const handleCopy = async () => {
    if (currentOutput?.content.body) {
      await window.electronAPI?.clipboard.write(currentOutput.content.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getEmailData = () => {
    if (!currentOutput?.type || currentOutput.type !== 'email' || !currentOutput.content.structured) {
      return null
    }

    const structured = currentOutput.content.structured as {
      to?: string
      subject?: string
    }

    return {
      to: structured.to || '',
      subject: structured.subject || currentOutput.content.title || '',
      body: currentOutput.content.body || '',
    }
  }

  const handleOpenInMail = async () => {
    const emailData = getEmailData()
    if (!emailData) return

    // Encode body with proper line breaks for mailto
    const encodedBody = encodeURIComponent(emailData.body)
      .replace(/%0A/g, '%0D%0A') // Convert LF to CRLF for better compatibility

    const mailtoUrl = `mailto:${emailData.to}?subject=${encodeURIComponent(emailData.subject)}&body=${encodedBody}`

    if (window.electronAPI?.shell?.openExternal) {
      await window.electronAPI.shell.openExternal(mailtoUrl)
    } else {
      window.location.href = mailtoUrl
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with type badge and variant selector */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          {detectedType && <OutputTypeBadge type={detectedType} />}
        </div>

        {/* Variant Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] rounded-[var(--radius-md)]">
          {variants.map((variant) => (
            <button
              key={variant}
              onClick={() => setSelectedVariant(variant)}
              disabled={!outputVariants[variant]}
              className={`
                px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)]
                transition-all duration-[var(--transition-fast)]
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  selectedVariant === variant
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }
              `}
            >
              {variantLabels[variant]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full"
            >
              <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-[var(--text-secondary)] text-sm">
                Generiere Output...
              </p>
            </motion.div>
          ) : currentOutput ? (
            <motion.div
              key={`${currentOutput.id}-${selectedVariant}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Email-specific header */}
              {currentOutput.type === 'email' && currentOutput.content.structured && (
                <div className="space-y-2 pb-3 border-b border-[var(--border-subtle)]">
                  {(currentOutput.content.structured as { to?: string }).to && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[var(--text-muted)] w-12">An:</span>
                      <span className="text-[var(--text-primary)]">
                        {(currentOutput.content.structured as { to: string }).to}
                      </span>
                    </div>
                  )}
                  {currentOutput.content.title && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[var(--text-muted)] w-12">Betreff:</span>
                      <span className="text-[var(--text-primary)] font-medium">
                        {currentOutput.content.title}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Title for non-email types */}
              {currentOutput.type !== 'email' && currentOutput.content.title && (
                <h2 className="text-lg font-medium text-[var(--text-primary)]">
                  {currentOutput.content.title}
                </h2>
              )}

              {/* Body */}
              <div className="prose prose-sm prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-[var(--text-secondary)] leading-relaxed">
                  {currentOutput.content.body}
                </div>
              </div>

              {/* Metadata */}
              <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>
                  {currentOutput.metadata.wordCount} Wörter · ca.{' '}
                  {currentOutput.metadata.estimatedReadTime} Min. Lesezeit
                </span>
                <span>
                  {new Date(currentOutput.createdAt).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center"
            >
              <p className="text-[var(--text-tertiary)] text-sm">
                Kein Output vorhanden
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      {currentOutput && (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border-subtle)]">
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <CheckIcon className="w-4 h-4 mr-1.5" />
                Kopiert!
              </>
            ) : (
              <>
                <CopyIcon className="w-4 h-4 mr-1.5" />
                Kopieren
              </>
            )}
          </Button>

          {currentOutput.type === 'email' && (
            <Button variant="secondary" size="sm" onClick={handleOpenInMail}>
              <MailIcon className="w-4 h-4 mr-1.5" />
              Mail
            </Button>
          )}

          <Button variant="ghost" size="sm">
            <RefreshIcon className="w-4 h-4 mr-1.5" />
            Neu generieren
          </Button>
        </div>
      )}
    </div>
  )
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 7.387v10.478c0 .23-.08.424-.238.576-.158.154-.352.23-.58.23h-8.547v-6.959l1.6 1.229c.101.063.222.094.363.094.142 0 .263-.031.364-.094l6.802-5.22v-.117l-7.166 5.494-1.963-1.51V5.787h8.547c.228 0 .422.076.58.229.158.152.238.346.238.575v.796zM14.635 5.787v6.287l-1.885 1.449V5.787h1.885zm-3.77 0v8.693l-1.886-1.449V5.787h1.886zM7.094 5.787v7.287L.237 7.617v-.035l6.857 5.26v5.828H.818c-.228 0-.422-.076-.58-.23C.08 18.29 0 18.095 0 17.865V7.387c0-.229.08-.423.238-.575.158-.153.352-.229.58-.229h6.276v-.796z"/>
    </svg>
  )
}

function SourceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}

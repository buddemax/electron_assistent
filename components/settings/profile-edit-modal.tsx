'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type {
  UserProfile,
  CompanySize,
  FormalityLevel,
  PrimaryUseCase,
  TechnicalLevel,
  OutputLength,
} from '@/types/profile'

interface ProfileEditModalProps {
  readonly isOpen: boolean
  readonly profile: UserProfile
  readonly onClose: () => void
  readonly onSave: (profile: UserProfile) => void
}

export function ProfileEditModal({
  isOpen,
  profile,
  onClose,
  onSave,
}: ProfileEditModalProps) {
  const [editedProfile, setEditedProfile] = useState<UserProfile>(profile)

  const handleFieldChange = useCallback(
    <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => {
      setEditedProfile((prev) => ({
        ...prev,
        [field]: value,
      }))
    },
    []
  )

  const handleSave = useCallback(() => {
    onSave(editedProfile)
    onClose()
  }, [editedProfile, onSave, onClose])

  const handleCancel = useCallback(() => {
    setEditedProfile(profile)
    onClose()
  }, [profile, onClose])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleCancel}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md mx-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-medium text-[var(--text-primary)]">
              Profil bearbeiten
            </h2>
            <button
              onClick={handleCancel}
              className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Job Role */}
            <ProfileField
              label="Rolle"
              value={editedProfile.jobRole ?? ''}
              onChange={(v) => handleFieldChange('jobRole', v || null)}
              type="text"
              placeholder="z.B. Entwickler, Manager..."
            />

            {/* Industry */}
            <ProfileField
              label="Branche"
              value={editedProfile.industry ?? ''}
              onChange={(v) => handleFieldChange('industry', v || null)}
              type="text"
              placeholder="z.B. Technologie, Finanzen..."
            />

            {/* Company Size */}
            <ProfileField
              label="Unternehmensgröße"
              value={editedProfile.companySize ?? ''}
              onChange={(v) =>
                handleFieldChange('companySize', (v || null) as CompanySize | null)
              }
              type="select"
              options={[
                { value: '', label: 'Nicht angegeben' },
                { value: 'solo', label: 'Solo/Freelancer' },
                { value: 'small', label: 'Klein (2-10)' },
                { value: 'medium', label: 'Mittel (11-50)' },
                { value: 'large', label: 'Groß (51-500)' },
                { value: 'enterprise', label: 'Konzern (500+)' },
              ]}
            />

            {/* Formality Level */}
            <ProfileField
              label="Formalität"
              value={editedProfile.formalityLevel}
              onChange={(v) => handleFieldChange('formalityLevel', v as FormalityLevel)}
              type="select"
              options={[
                { value: 'casual', label: 'Locker (Du-Form)' },
                { value: 'neutral', label: 'Neutral' },
                { value: 'formal', label: 'Formell (Sie-Form)' },
                { value: 'very-formal', label: 'Sehr formell' },
              ]}
            />

            {/* Signature Name */}
            <ProfileField
              label="E-Mail-Signatur"
              value={editedProfile.signatureName ?? ''}
              onChange={(v) => handleFieldChange('signatureName', v || null)}
              type="text"
              placeholder="z.B. Max, Max Mustermann"
            />

            {/* Primary Use Case */}
            <ProfileField
              label="Hauptanwendung"
              value={editedProfile.primaryUseCase ?? ''}
              onChange={(v) =>
                handleFieldChange('primaryUseCase', (v || null) as PrimaryUseCase | null)
              }
              type="select"
              options={[
                { value: '', label: 'Nicht angegeben' },
                { value: 'emails', label: 'E-Mails schreiben' },
                { value: 'meetings', label: 'Meeting-Notizen' },
                { value: 'tasks', label: 'Aufgaben & Todos' },
                { value: 'brainstorm', label: 'Brainstorming' },
                { value: 'general', label: 'Verschiedenes' },
              ]}
            />

            {/* Technical Level */}
            <ProfileField
              label="Technisches Niveau"
              value={editedProfile.technicalLevel ?? ''}
              onChange={(v) =>
                handleFieldChange('technicalLevel', (v || null) as TechnicalLevel | null)
              }
              type="select"
              options={[
                { value: '', label: 'Nicht angegeben' },
                { value: 'non-technical', label: 'Nicht technisch' },
                { value: 'some-technical', label: 'Etwas technisch' },
                { value: 'technical', label: 'Technisch' },
                { value: 'expert', label: 'Sehr technisch' },
              ]}
            />

            {/* Output Length */}
            <ProfileField
              label="Output-Länge"
              value={editedProfile.preferredOutputLength}
              onChange={(v) => handleFieldChange('preferredOutputLength', v as OutputLength)}
              type="select"
              options={[
                { value: 'concise', label: 'Kurz & knapp' },
                { value: 'balanced', label: 'Ausgewogen' },
                { value: 'detailed', label: 'Ausführlich' },
              ]}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Speichern
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Helper Components
interface ProfileFieldProps {
  readonly label: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly type: 'text' | 'select'
  readonly placeholder?: string
  readonly options?: readonly { value: string; label: string }[]
}

function ProfileField({
  label,
  value,
  onChange,
  type,
  placeholder,
  options,
}: ProfileFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
        {label}
      </label>
      {type === 'text' ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
        />
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        >
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

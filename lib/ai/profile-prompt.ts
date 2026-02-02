import type {
  UserProfile,
  FormalityLevel,
  TechnicalLevel,
  OutputLength,
} from '@/types/profile'

const FORMALITY_DESCRIPTIONS: Record<FormalityLevel, string> = {
  casual: 'Verwende die Du-Form und einen lockeren, freundlichen Ton.',
  neutral: 'Passe die Formalität situationsabhängig an.',
  formal: 'Verwende die Sie-Form und einen professionellen, höflichen Ton.',
  'very-formal':
    'Verwende die Sie-Form mit sehr formeller, geschäftlicher Sprache.',
}

const TECHNICAL_DESCRIPTIONS: Record<TechnicalLevel, string> = {
  'non-technical':
    'Vermeide Fachbegriffe und erkläre technische Konzepte einfach.',
  'some-technical': 'Verwende gelegentlich Fachbegriffe, aber erkläre sie bei Bedarf.',
  technical: 'Verwende branchenübliche Fachbegriffe ohne zusätzliche Erklärungen.',
  expert:
    'Verwende präzise technische Terminologie und gehe von Expertenwissen aus.',
}

const OUTPUT_LENGTH_DESCRIPTIONS: Record<OutputLength, string> = {
  concise: 'Halte Texte kurz und prägnant, fokussiere auf das Wesentliche.',
  balanced: 'Finde eine gute Balance zwischen Kürze und Ausführlichkeit.',
  detailed: 'Erstelle ausführliche Texte mit allen relevanten Details.',
}

export function buildProfileContext(profile: UserProfile): string {
  const parts: string[] = []

  if (profile.jobRole) {
    parts.push(`Rolle des Nutzers: ${profile.jobRole}`)
  }

  if (profile.industry) {
    parts.push(`Branche: ${profile.industry}`)
  }

  if (profile.companySize) {
    const sizeDescriptions: Record<string, string> = {
      solo: 'Solo/Freelancer',
      small: 'kleines Unternehmen (2-10 Mitarbeiter)',
      medium: 'mittelständisches Unternehmen (11-50 Mitarbeiter)',
      large: 'großes Unternehmen (51-500 Mitarbeiter)',
      enterprise: 'Konzern (500+ Mitarbeiter)',
    }
    parts.push(`Unternehmensgröße: ${sizeDescriptions[profile.companySize]}`)
  }

  // Only include formality if not default
  if (profile.formalityLevel !== 'neutral') {
    parts.push(FORMALITY_DESCRIPTIONS[profile.formalityLevel])
  }

  if (profile.signatureName) {
    parts.push(`E-Mail-Signatur: "${profile.signatureName}"`)
  }

  if (profile.primaryUseCase) {
    const useCaseDescriptions: Record<string, string> = {
      emails: 'E-Mails schreiben',
      meetings: 'Meeting-Notizen erstellen',
      tasks: 'Aufgaben und Todos verwalten',
      brainstorm: 'Brainstorming und Ideenfindung',
      general: 'Verschiedene Aufgaben',
    }
    parts.push(`Hauptanwendungsfall: ${useCaseDescriptions[profile.primaryUseCase]}`)
  }

  if (profile.technicalLevel) {
    parts.push(TECHNICAL_DESCRIPTIONS[profile.technicalLevel])
  }

  // Only include output length if not default
  if (profile.preferredOutputLength !== 'balanced') {
    parts.push(OUTPUT_LENGTH_DESCRIPTIONS[profile.preferredOutputLength])
  }

  if (parts.length === 0) {
    return ''
  }

  return `\n\nNutzerprofil:\n${parts.map((p) => `- ${p}`).join('\n')}`
}

export function hasProfileData(profile: UserProfile): boolean {
  return (
    profile.jobRole !== null ||
    profile.industry !== null ||
    profile.companySize !== null ||
    profile.signatureName !== null ||
    profile.primaryUseCase !== null ||
    profile.technicalLevel !== null ||
    profile.formalityLevel !== 'neutral' ||
    profile.preferredOutputLength !== 'balanced'
  )
}

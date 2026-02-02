/**
 * User profile types for onboarding and personalization
 */

export type CompanySize = 'solo' | 'small' | 'medium' | 'large' | 'enterprise'

export type FormalityLevel = 'casual' | 'neutral' | 'formal' | 'very-formal'

export type PrimaryUseCase = 'emails' | 'meetings' | 'tasks' | 'brainstorm' | 'general'

export type TechnicalLevel = 'non-technical' | 'some-technical' | 'technical' | 'expert'

export type OutputLength = 'concise' | 'balanced' | 'detailed'

export interface UserProfile {
  readonly jobRole: string | null
  readonly industry: string | null
  readonly companySize: CompanySize | null
  readonly formalityLevel: FormalityLevel
  readonly signatureName: string | null
  readonly primaryUseCase: PrimaryUseCase | null
  readonly technicalLevel: TechnicalLevel | null
  readonly preferredOutputLength: OutputLength
}

export interface OnboardingOption {
  readonly value: string
  readonly label: string
  readonly description?: string
}

export interface OnboardingStep {
  readonly id: string
  readonly type: 'select' | 'text' | 'hybrid'
  readonly title: string
  readonly description?: string
  readonly options?: readonly OnboardingOption[]
  readonly textPlaceholder?: string
  readonly profileField: keyof UserProfile
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  jobRole: null,
  industry: null,
  companySize: null,
  formalityLevel: 'neutral',
  signatureName: null,
  primaryUseCase: null,
  technicalLevel: null,
  preferredOutputLength: 'balanced',
}

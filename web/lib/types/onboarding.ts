import type { AddressFormData } from './address'

export type OnboardingIntent =
  | 'join_workshop'
  | 'create_organization'
  | 'accept_invitation'
  | 'exploring'

export type OnboardingStep = 1 | 2 | 3 | 4

export interface StepOneData {
  first_name: string
  last_name: string
  email: string
  password: string
  password_confirmation: string
}

export interface StepTwoData {
  pronouns: string
  phone_number: string
  timezone: string
  address: AddressFormData | null
}

export interface StepThreeData {
  intent: OnboardingIntent | null
}

export interface StepFourData {
  join_code?: string
  organization_name?: string
  organization_slug?: string
  invitation_token?: string
}

export const PRONOUN_OPTIONS = [
  { value: '',           label: 'Prefer not to say' },
  { value: 'He/him',    label: 'He/him' },
  { value: 'She/her',   label: 'She/her' },
  { value: 'They/them', label: 'They/them' },
  { value: 'Other',     label: 'Other — I\'ll type it in' },
] as const

export interface IntentOption {
  id: OnboardingIntent
  icon: string
  title: string
  description: string
  cta: string
}

export const INTENT_OPTIONS: IntentOption[] = [
  {
    id: 'join_workshop',
    icon: '🎯',
    title: 'Join a Workshop',
    description: 'I have a workshop join code from an organizer.',
    cta: 'Enter Join Code →',
  },
  {
    id: 'create_organization',
    icon: '🏢',
    title: 'Manage Workshops',
    description: 'I want to create an organization and run workshops.',
    cta: 'Set Up Organization →',
  },
  {
    id: 'accept_invitation',
    icon: '🎓',
    title: 'Accept a Leader Invitation',
    description: 'I was invited to lead a workshop session.',
    cta: 'Enter Invitation Code →',
  },
  {
    id: 'exploring',
    icon: '👋',
    title: 'Just Exploring',
    description: 'I want to look around and decide later.',
    cta: 'Go to Dashboard →',
  },
]

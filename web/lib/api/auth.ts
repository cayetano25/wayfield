import { apiGet, apiPatch, apiPost } from './client'
import { setToken, setStoredUser, type AdminUser } from '@/lib/auth/session'
import type { OnboardingIntent, StepFourData, StepOneData, StepTwoData } from '@/lib/types/onboarding'

interface RegisterResponse {
  token: string
  user: AdminUser
}

export async function registerUser(data: StepOneData): Promise<{ token: string; user: AdminUser }> {
  // TODO [AUTH]: Token storage — the API sets a Set-Cookie header.
  // For now we store the token in a cookie via setToken().
  const res = await apiPost<RegisterResponse>('/auth/register', data)
  setToken(res.token)
  setStoredUser(res.user)
  return res
}

export async function updateOnboardingProfile(data: StepTwoData): Promise<void> {
  await apiPatch<void>('/onboarding/profile', {
    pronouns: data.pronouns || null,
    phone_number: data.phone_number || null,
    timezone: data.timezone || null,
    address: data.address,
  })
}

export async function completeOnboarding(
  data: { intent: OnboardingIntent } & StepFourData,
): Promise<{ redirect: string; message: string; organization_id?: number }> {
  return apiPost<{ redirect: string; message: string; organization_id?: number }>('/onboarding/complete', data)
}

export async function getOnboardingStatus(): Promise<{
  onboarding_completed: boolean
  steps: { account_basics: boolean; profile: boolean; intent: boolean }
  user: AdminUser
}> {
  return apiGet('/onboarding/status')
}

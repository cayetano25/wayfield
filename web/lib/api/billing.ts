import { apiGet, apiPost } from './client'
import type { Plan, BillingCycle } from '@/lib/types/billing'

export interface CheckoutSessionResponse {
  checkout_url: string
}

export function getPlans(): Promise<Plan[]> {
  return apiGet<Plan[]>('/plans')
}

export function createCheckoutSession(params: {
  plan_code: string
  billing: BillingCycle
  org_id: number
}): Promise<CheckoutSessionResponse> {
  return apiPost<CheckoutSessionResponse>('/billing/checkout', params)
}

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
  const { org_id, ...body } = params
  return apiPost<CheckoutSessionResponse>(`/organizations/${org_id}/billing/checkout`, body)
}

export function cancelSubscription(orgId: number): Promise<void> {
  return apiPost(`/organizations/${orgId}/billing/cancel`)
}

export function resumeSubscription(orgId: number): Promise<void> {
  return apiPost(`/organizations/${orgId}/billing/resume`)
}

export function createSetupIntent(orgId: number): Promise<{ client_secret: string }> {
  return apiPost(`/organizations/${orgId}/billing/setup-intent`)
}

export function subscribeToPlan(params: {
  org_id: number
  plan_code: string
  interval: BillingCycle
  payment_method_id: string
}): Promise<void> {
  const { org_id, ...body } = params
  return apiPost(`/organizations/${org_id}/billing/subscribe`, body)
}

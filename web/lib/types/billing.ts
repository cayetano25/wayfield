export interface PlanLimits {
  organizations: number | null
  organizers: number | null
  active_workshops: number | null
  participants_per_workshop: number | null
}

export interface PlanFeatures {
  scheduling: boolean
  session_selection: boolean
  self_check_in: boolean
  offline_access: boolean
  leader_invitations: boolean
  basic_notifications: boolean
  capacity_enforcement: boolean
  waitlists: boolean
  reminder_automation: boolean
  basic_analytics: boolean
  attendance_summaries: boolean
  leader_day_notifications: boolean
  advanced_automation: boolean
  segmentation: boolean
  multi_workshop_reporting: boolean
  api_access: boolean
  webhooks: boolean
  advanced_permissions: boolean
  custom_branding: boolean
  sso: boolean
  white_label: boolean
}

export interface Plan {
  code: string
  display_name: string
  monthly_cents: number | null
  annual_cents: number | null
  annual_discount_pct: number
  limits: PlanLimits
  features: PlanFeatures
  has_stripe: boolean
}

export type BillingCycle = 'monthly' | 'annual'

export interface PricingPageProps {
  // Context: 'onboarding' = shown during org creation
  //          'billing'    = shown on /admin/organization/billing
  //          'upgrade'    = shown as a modal/page when limit is hit
  context: 'onboarding' | 'billing' | 'upgrade'

  currentPlanCode?: string     // set in billing/upgrade context
  orgId?: number               // set in billing/upgrade context
  limitHitKey?: string         // set in upgrade context only — highlights the right card
  onPlanSelected?: (planCode: string, billing: BillingCycle) => void
  // Called in onboarding context when user picks a plan before checkout
  onClose?: () => void
  // Called in upgrade context (modal) when user dismisses
}

export interface PlanLimitError {
  error: 'plan_limit_reached'
  limit_key: string
  current_count: number
  limit: number
  current_plan: string
  current_plan_display: string
  upgrade_to: string
  upgrade_to_display: string
  upgrade_url: string
  message: string
}

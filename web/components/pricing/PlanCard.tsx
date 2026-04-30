'use client'

import { CheckCircle } from 'lucide-react'
import type { Plan, BillingCycle, PricingPageProps } from '@/lib/types/billing'

interface PlanCardProps {
  plan: Plan
  billingCycle: BillingCycle
  currentPlanCode?: string
  context: PricingPageProps['context']
  isHighlighted?: boolean
  limitHitKey?: string
  onSelectPlan: (code: string, cycle: BillingCycle) => void
  isLoading?: boolean
}

const TAGLINES: Record<string, string> = {
  free: 'Run your first workshops without friction.',
  starter: 'Run workshops consistently—without losing control.',
  pro: 'Operate your workshop program like a system.',
  enterprise: 'Full control for workshop organizations at scale.',
}

const BEST_FOR: Record<string, string> = {
  free: 'Solo organizers testing the workflow',
  starter: 'Small recurring workshop businesses',
  pro: 'Serious educators and workshop teams',
  enterprise: 'Multi-team, multi-brand, governed deployments',
}

interface FeatureItem {
  text: string
  bold?: boolean
}

const FEATURES: Record<string, { inherit?: string; items: FeatureItem[] }> = {
  free: {
    items: [
      { text: '2 active workshops' },
      { text: '75 participants per workshop' },
      { text: 'Scheduling and logistics' },
      { text: 'Leader invitations' },
      { text: 'Session selection' },
      { text: 'Self check-in' },
      { text: 'Core offline access' },
      { text: 'Basic notifications' },
    ],
  },
  starter: {
    inherit: 'Everything in Foundation, plus:',
    items: [
      { text: '5 organization managers' },
      { text: '10 active workshops' },
      { text: '250 participants per workshop' },
      { text: 'Capacity limits and waitlists' },
      { text: 'Reminder automation' },
      { text: 'Basic analytics' },
      { text: 'Attendance summaries' },
      { text: 'Leader day-of-session notifications' },
    ],
  },
  pro: {
    inherit: 'Everything in Creator, plus:',
    items: [
      { text: 'Unlimited workshops' },
      { text: 'Advanced automation and segmentation' },
      { text: 'Multi-workshop reporting' },
      { text: 'API access and webhooks' },
      { text: 'Advanced permissions' },
      { text: 'Priority support' },
      { text: 'Custom branding and domains', bold: true },
    ],
  },
  enterprise: {
    items: [
      { text: 'SSO / SAML' },
      { text: 'White-label platform' },
      { text: 'Dedicated onboarding' },
      { text: 'Enterprise SLA' },
      { text: 'Advanced governance' },
    ],
  },
}

function formatMonthlyPrice(cents: number): string {
  const dollars = cents / 100
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`
}

function resolvesLimit(planCode: string, limitHitKey: string): string | null {
  const resolutions: Record<string, Record<string, string>> = {
    active_workshops: {
      starter: 'This plan includes up to 10 active workshops',
      pro: 'This plan includes unlimited workshops',
      enterprise: 'This plan includes unlimited workshops',
    },
    participants_per_workshop: {
      starter: 'This plan supports up to 250 participants per workshop',
      pro: 'This plan supports higher participant limits',
      enterprise: 'This plan supports custom participant limits',
    },
    organizers: {
      starter: 'This plan supports up to 5 organization managers',
      pro: 'This plan supports more organization managers',
      enterprise: 'This plan supports unlimited managers',
    },
  }
  return resolutions[limitHitKey]?.[planCode] ?? null
}

// Determine upgrade vs downgrade vs same based on plan order
const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise']

function planRelation(currentCode: string | undefined, cardCode: string): 'current' | 'upgrade' | 'downgrade' | 'none' {
  if (!currentCode) return 'upgrade'
  if (currentCode === cardCode) return 'current'
  const currentIdx = PLAN_ORDER.indexOf(currentCode)
  const cardIdx = PLAN_ORDER.indexOf(cardCode)
  if (currentIdx === -1 || cardIdx === -1) return 'none'
  return cardIdx > currentIdx ? 'upgrade' : 'downgrade'
}

export function PlanCard({
  plan,
  billingCycle,
  currentPlanCode,
  context,
  isHighlighted,
  limitHitKey,
  onSelectPlan,
  isLoading,
}: PlanCardProps) {
  const isEnterprise = plan.code === 'enterprise'
  const featureConfig = FEATURES[plan.code]
  const relation = planRelation(currentPlanCode, plan.code)

  const cardStyle: React.CSSProperties = isEnterprise
    ? {
        background: '#2E2E2E',
        borderRadius: '16px',
        padding: '28px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }
    : isHighlighted
      ? {
          background: 'white',
          border: '2px solid #0FA3B1',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 4px 20px rgba(15,163,177,0.15)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }
      : {
          background: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }

  const textPrimary = isEnterprise ? 'white' : '#2E2E2E'
  const textSecondary = isEnterprise ? 'rgba(255,255,255,0.6)' : '#6B7280'
  const checkColor = isEnterprise ? 'rgba(255,255,255,0.7)' : '#0FA3B1'
  const featureTextColor = isEnterprise ? 'rgba(255,255,255,0.85)' : '#374151'
  const dividerColor = isEnterprise ? 'rgba(255,255,255,0.1)' : '#F3F4F6'

  // Price block
  let priceDisplay: React.ReactNode
  if (isEnterprise) {
    priceDisplay = (
      <div style={{ marginTop: '20px' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '40px', fontWeight: 700, color: 'white' }}>
          Custom
        </span>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
          Contact us for pricing
        </div>
      </div>
    )
  } else if (plan.monthly_cents === 0 || plan.monthly_cents === null) {
    priceDisplay = (
      <div style={{ marginTop: '20px' }}>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 800, color: textPrimary }}>
          $0
        </span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#9CA3AF', marginLeft: '4px' }}>
          /mo
        </span>
      </div>
    )
  } else {
    const monthlyDollars = plan.monthly_cents / 100
    const annualMonthlyRate = monthlyDollars * 0.8
    const annualTotal = monthlyDollars * 12 * 0.8

    const displayStr = billingCycle === 'monthly'
      ? formatMonthlyPrice(plan.monthly_cents)
      : `$${annualMonthlyRate.toFixed(0)}`

    priceDisplay = (
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '36px', fontWeight: 800, color: textPrimary }}>
            {displayStr}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#9CA3AF' }}>
            /mo
          </span>
        </div>
        {billingCycle === 'annual' && (
          <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
            Billed as ${annualTotal.toFixed(2)}/year · Save 20%
          </div>
        )}
      </div>
    )
  }

  // CTA button
  let ctaButton: React.ReactNode

  if (context === 'onboarding') {
    if (isEnterprise) {
      ctaButton = (
        <button
          type="button"
          onClick={() => onSelectPlan(plan.code, billingCycle)}
          style={enterpriseOutlineBtn}
        >
          Contact Us
        </button>
      )
    } else if (plan.code === 'free') {
      ctaButton = (
        <button type="button" onClick={() => onSelectPlan(plan.code, billingCycle)} style={tealOutlineBtn}>
          Start free
        </button>
      )
    } else {
      ctaButton = (
        <button
          type="button"
          disabled={!!isLoading}
          onClick={() => onSelectPlan(plan.code, billingCycle)}
          style={tealFilledBtn(!!isLoading)}
        >
          {isLoading ? <Spinner /> : null}
          {isLoading ? 'Redirecting…' : `Upgrade to ${plan.display_name}`}
        </button>
      )
    }
  } else if (isEnterprise) {
    ctaButton = (
      <button
        type="button"
        onClick={() => onSelectPlan(plan.code, billingCycle)}
        style={enterpriseOutlineBtn}
      >
        Contact Us
      </button>
    )
  } else if (relation === 'current') {
    ctaButton = (
      <button type="button" disabled style={currentPlanBtn}>
        Current Plan
      </button>
    )
  } else if (relation === 'upgrade') {
    ctaButton = (
      <button
        type="button"
        disabled={!!isLoading}
        onClick={() => onSelectPlan(plan.code, billingCycle)}
        style={tealFilledBtn(!!isLoading)}
      >
        {isLoading ? <Spinner /> : null}
        {isLoading ? 'Redirecting…' : `Upgrade to ${plan.display_name}`}
      </button>
    )
  } else if (relation === 'downgrade') {
    ctaButton = (
      <button
        type="button"
        disabled={!!isLoading}
        onClick={() => onSelectPlan(plan.code, billingCycle)}
        style={downgradeBtn(!!isLoading)}
      >
        {isLoading ? <DowngradeSpinner /> : null}
        {isLoading ? 'Redirecting…' : `Downgrade to ${plan.display_name}`}
      </button>
    )
  }

  const limitResolution = limitHitKey ? resolvesLimit(plan.code, limitHitKey) : null

  return (
    <div style={cardStyle}>
      {/* Top badge — only for starter (highlighted) */}
      {plan.code === 'starter' ? (
        <div style={{ marginBottom: '10px' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontFamily: 'var(--font-sans)',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              background: '#0FA3B1',
              color: 'white',
            }}
          >
            MOST PRACTICAL
          </span>
        </div>
      ) : (
        <div style={{ height: '22px', marginBottom: '10px' }} />
      )}

      {/* Plan name */}
      <div>
        {/* Small plan-tier label for pro */}
        {plan.code === 'pro' && (
          <div
            style={{
              fontSize: '9px',
              color: '#0FA3B1',
              letterSpacing: '0.12em',
              fontFamily: 'var(--font-sans)',
              textTransform: 'uppercase',
              fontWeight: 700,
              marginBottom: '2px',
            }}
          >
            BEST FOR SERIOUS OPERATORS
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', fontWeight: 700, color: textPrimary }}>
          {plan.display_name}
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: textSecondary, marginTop: '4px' }}>
          {TAGLINES[plan.code]}
        </div>
      </div>

      {/* Price */}
      {priceDisplay}

      {/* Divider */}
      <div style={{ height: '1px', background: dividerColor, margin: '20px 0' }} />

      {/* Best for */}
      <div>
        <div
          style={{
            fontSize: '10px',
            color: isEnterprise ? 'rgba(255,255,255,0.4)' : '#9CA3AF',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontFamily: 'var(--font-sans)',
            marginBottom: '6px',
          }}
        >
          Best For:
        </div>
        <div
          style={{
            fontSize: '13px',
            color: isEnterprise ? 'rgba(255,255,255,0.7)' : '#4B5563',
            fontStyle: 'italic',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {BEST_FOR[plan.code]}
        </div>
      </div>

      {/* Features */}
      <div style={{ marginTop: '16px' }}>
        <div
          style={{
            fontSize: '11px',
            color: isEnterprise ? 'rgba(255,255,255,0.4)' : '#9CA3AF',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {"What's included:"}
        </div>

        {featureConfig?.inherit && (
          <div
            style={{
              fontSize: '11px',
              color: isEnterprise ? 'rgba(255,255,255,0.4)' : '#9CA3AF',
              fontStyle: 'italic',
              fontFamily: 'var(--font-sans)',
              marginTop: '8px',
              marginBottom: '6px',
            }}
          >
            {featureConfig.inherit}
          </div>
        )}

        <div
          style={{
            marginTop: featureConfig?.inherit ? '0' : '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {featureConfig?.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <CheckCircle size={14} style={{ color: checkColor, flexShrink: 0, marginTop: '2px' }} />
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  color: featureTextColor,
                  fontWeight: item.bold ? 600 : 400,
                }}
              >
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA — pushed to bottom */}
      <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
        {ctaButton}
      </div>

      {/* Limit resolution hint */}
      {limitResolution && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#0FA3B1', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
          {limitResolution}
        </div>
      )}
    </div>
  )
}

// ---- Shared button styles ----

const tealFilledBtn = (loading: boolean): React.CSSProperties => ({
  marginTop: '0',
  width: '100%',
  height: '44px',
  borderRadius: '8px',
  background: loading ? '#7DD3D8' : '#0FA3B1',
  color: 'white',
  border: 'none',
  fontFamily: 'var(--font-sans)',
  fontSize: '14px',
  fontWeight: 600,
  cursor: loading ? 'not-allowed' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
})

const tealOutlineBtn: React.CSSProperties = {
  marginTop: '0',
  width: '100%',
  height: '44px',
  borderRadius: '8px',
  background: 'white',
  color: '#0FA3B1',
  border: '1px solid #0FA3B1',
  fontFamily: 'var(--font-sans)',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const currentPlanBtn: React.CSSProperties = {
  marginTop: '0',
  width: '100%',
  height: '44px',
  borderRadius: '8px',
  background: '#F3F4F6',
  color: '#9CA3AF',
  border: '1px solid #E5E7EB',
  fontFamily: 'var(--font-sans)',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'not-allowed',
}

const downgradeBtn = (loading: boolean): React.CSSProperties => ({
  marginTop: '0',
  width: '100%',
  height: '44px',
  borderRadius: '8px',
  background: 'white',
  color: loading ? '#9CA3AF' : '#E67E22',
  border: `1px solid ${loading ? '#E5E7EB' : '#E67E22'}`,
  fontFamily: 'var(--font-sans)',
  fontSize: '14px',
  fontWeight: 600,
  cursor: loading ? 'not-allowed' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
})

const enterpriseOutlineBtn: React.CSSProperties = {
  marginTop: '0',
  width: '100%',
  height: '44px',
  borderRadius: '8px',
  background: 'rgba(255,255,255,0.12)',
  color: 'white',
  border: '1px solid rgba(255,255,255,0.3)',
  fontFamily: 'var(--font-sans)',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

function Spinner() {
  return (
    <span
      style={{
        width: '14px',
        height: '14px',
        border: '2px solid rgba(255,255,255,0.4)',
        borderTopColor: 'white',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )
}

function DowngradeSpinner() {
  return (
    <span
      style={{
        width: '14px',
        height: '14px',
        border: '2px solid rgba(230,126,34,0.3)',
        borderTopColor: '#E67E22',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )
}

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

function formatCents(cents: number): string {
  return `$${Math.round(cents / 100)}`
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
  const isCurrentPlan = currentPlanCode === plan.code
  const featureConfig = FEATURES[plan.code]

  const cardStyle: React.CSSProperties = isEnterprise
    ? {
        background: '#1A2535',
        borderRadius: '12px',
        padding: '28px',
        display: 'flex',
        flexDirection: 'column',
      }
    : isHighlighted
      ? {
          background: 'white',
          border: '2px solid #0FA3B1',
          borderRadius: '12px',
          padding: '28px',
          boxShadow: '0 4px 20px rgba(15,163,177,0.15)',
          display: 'flex',
          flexDirection: 'column',
        }
      : {
          background: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
        }

  const textPrimary = isEnterprise ? 'white' : '#2E2E2E'
  const textSecondary = isEnterprise ? 'rgba(255,255,255,0.6)' : '#6B7280'
  const checkColor = isEnterprise ? 'rgba(255,255,255,0.7)' : '#0FA3B1'
  const featureTextColor = isEnterprise ? 'rgba(255,255,255,0.85)' : '#374151'
  const dividerColor = isEnterprise ? 'rgba(255,255,255,0.1)' : '#F3F4F6'

  const badge =
    plan.code === 'starter'
      ? { text: 'MOST PRACTICAL FOR GROWING WORKSHOPS', bg: '#0FA3B1', color: 'white' }
      : plan.code === 'pro'
        ? { text: 'BEST FOR SERIOUS OPERATORS', bg: '#F0FDF4', color: '#065F46' }
        : null

  // Price
  let priceDisplay: React.ReactNode
  if (isEnterprise) {
    priceDisplay = (
      <div style={{ marginTop: '20px' }}>
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '32px',
            fontWeight: 700,
            color: 'white',
          }}
        >
          Custom
        </span>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
          Contact us for pricing
        </div>
      </div>
    )
  } else if (plan.monthly_cents === 0) {
    priceDisplay = (
      <div style={{ marginTop: '20px' }}>
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '36px',
            fontWeight: 800,
            color: textPrimary,
          }}
        >
          $0
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            color: '#9CA3AF',
            marginLeft: '4px',
          }}
        >
          /mo
        </span>
      </div>
    )
  } else if (plan.monthly_cents !== null) {
    const displayPrice =
      billingCycle === 'monthly'
        ? formatCents(plan.monthly_cents)
        : formatCents(plan.annual_cents ?? plan.monthly_cents)
    priceDisplay = (
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '36px',
              fontWeight: 800,
              color: textPrimary,
            }}
          >
            {displayPrice}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              color: '#9CA3AF',
            }}
          >
            /mo
          </span>
        </div>
        {billingCycle === 'annual' && (
          <div style={{ fontSize: '11px', color: '#0FA3B1', marginTop: '4px' }}>
            Billed annually · Save 15%
          </div>
        )}
        {isCurrentPlan && context !== 'onboarding' && (
          <div style={{ marginTop: '8px' }}>
            <span
              style={{
                background: '#F0FDF4',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: '9999px',
              }}
            >
              Current Plan
            </span>
          </div>
        )}
      </div>
    )
  } else {
    priceDisplay = null
  }

  // CTA button
  let ctaButton: React.ReactNode
  if (isEnterprise) {
    ctaButton = (
      <button
        type="button"
        onClick={() => onSelectPlan(plan.code, billingCycle)}
        style={{
          marginTop: '24px',
          width: '100%',
          height: '44px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.15)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.3)',
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.25)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
        }}
      >
        Talk to sales
      </button>
    )
  } else if (plan.code === 'free') {
    if (context === 'onboarding') {
      ctaButton = (
        <button
          type="button"
          onClick={() => onSelectPlan(plan.code, billingCycle)}
          style={{
            marginTop: '24px',
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
          }}
        >
          Start free
        </button>
      )
    } else if (isCurrentPlan) {
      ctaButton = (
        <button
          type="button"
          disabled
          style={{
            marginTop: '24px',
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
          }}
        >
          Current Plan
        </button>
      )
    } else {
      ctaButton = null
    }
  } else {
    if (isCurrentPlan) {
      ctaButton = (
        <button
          type="button"
          disabled
          style={{
            marginTop: '24px',
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
          }}
        >
          Current Plan
        </button>
      )
    } else {
      const label = isLoading
        ? 'Redirecting to checkout…'
        : `Upgrade to ${plan.display_name}`
      ctaButton = (
        <button
          type="button"
          disabled={isLoading}
          onClick={() => onSelectPlan(plan.code, billingCycle)}
          style={{
            marginTop: '24px',
            width: '100%',
            height: '44px',
            borderRadius: '8px',
            background: isLoading ? '#7DD3D8' : '#0FA3B1',
            color: 'white',
            border: 'none',
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {isLoading && (
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
          )}
          {label}
        </button>
      )
    }
  }

  const limitResolution = limitHitKey ? resolvesLimit(plan.code, limitHitKey) : null

  return (
    <div style={cardStyle}>
      {/* Badge */}
      {badge ? (
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
              background: badge.bg,
              color: badge.color,
              height: '20px',
              lineHeight: '14px',
            }}
          >
            {badge.text}
          </span>
        </div>
      ) : (
        <div style={{ marginBottom: '0' }} />
      )}

      {/* Plan name */}
      <div>
        <div
          style={{
            fontSize: '10px',
            color: isEnterprise ? 'rgba(255,255,255,0.5)' : '#9CA3AF',
            letterSpacing: '0.1em',
            fontFamily: 'var(--font-sans)',
            textTransform: 'uppercase',
          }}
        >
          {plan.code.toUpperCase()}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '22px',
            fontWeight: 700,
            color: textPrimary,
          }}
        >
          {plan.display_name}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: textSecondary,
            marginTop: '4px',
          }}
        >
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
            marginBottom: '8px',
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
              <CheckCircle
                size={14}
                style={{ color: checkColor, flexShrink: 0, marginTop: '2px' }}
              />
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

      {/* CTA */}
      {ctaButton}

      {/* Limit resolution hint */}
      {limitResolution && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '11px',
            color: '#0FA3B1',
            textAlign: 'center',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {limitResolution}
        </div>
      )}
    </div>
  )
}

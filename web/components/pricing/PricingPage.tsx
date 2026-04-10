'use client'

import { useState, useEffect } from 'react'
import type { Plan, BillingCycle, PricingPageProps } from '@/lib/types/billing'
import { getPlans, createCheckoutSession } from '@/lib/api/billing'
import { BillingToggle } from './BillingToggle'
import { PlanCard } from './PlanCard'
import { FeatureComparisonTable } from './FeatureComparisonTable'
import { PricingFAQ } from './PricingFAQ'

const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise']

// Skeleton card for loading state
function PlanCardSkeleton() {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: '12px',
        padding: '28px',
        height: '480px',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    >
      <div
        style={{ height: '12px', background: '#F3F4F6', borderRadius: '6px', width: '60%', marginBottom: '12px' }}
      />
      <div
        style={{ height: '28px', background: '#F3F4F6', borderRadius: '6px', width: '80%', marginBottom: '8px' }}
      />
      <div
        style={{ height: '14px', background: '#F3F4F6', borderRadius: '6px', width: '90%', marginBottom: '24px' }}
      />
      <div
        style={{ height: '40px', background: '#F3F4F6', borderRadius: '6px', width: '50%', marginBottom: '20px' }}
      />
      <div style={{ height: '1px', background: '#F3F4F6', marginBottom: '20px' }} />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            height: '14px',
            background: '#F3F4F6',
            borderRadius: '6px',
            width: `${60 + i * 5}%`,
            marginBottom: '10px',
          }}
        />
      ))}
    </div>
  )
}

export function PricingPage({
  context,
  currentPlanCode,
  orgId,
  limitHitKey,
  onPlanSelected,
  onClose,
}: PricingPageProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  useEffect(() => {
    getPlans()
      .then((data) => {
        const ordered = PLAN_ORDER.map((code) => data.find((p) => p.code === code)).filter(
          (p): p is Plan => p !== undefined,
        )
        setPlans(ordered)
      })
      .catch(() => {
        // silently fail — page still renders with static skeleton
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const currentPlan = plans.find((p) => p.code === currentPlanCode)

  async function handleSelectPlan(planCode: string, cycle: BillingCycle) {
    if (planCode === 'free') {
      onPlanSelected?.(planCode, cycle)
      return
    }
    if (planCode === 'enterprise') {
      // TODO [SALES]: wire to sales contact flow or Calendly
      window.open('mailto:sales@wayfield.app', '_blank')
      return
    }

    if (!orgId) {
      onPlanSelected?.(planCode, cycle)
      return
    }

    setCheckoutLoading(planCode)
    try {
      const response = await createCheckoutSession({
        plan_code: planCode,
        billing: cycle,
        org_id: orgId,
      })
      window.location.href = response.checkout_url
    } catch (error) {
      // TODO: show error toast
      console.error('Checkout failed:', error)
    } finally {
      setCheckoutLoading(null)
    }
  }

  // Heading by context
  let heading: string
  let subheading: React.ReactNode
  if (context === 'onboarding') {
    heading = 'Choose your plan'
    subheading = (
      <span style={{ color: '#6B7280' }}>Start free and upgrade as you grow.</span>
    )
  } else if (context === 'billing') {
    heading = 'Plans & Pricing'
    subheading = (
      <span style={{ color: '#6B7280' }}>
        Your organization is on the{' '}
        <strong>{currentPlan?.display_name ?? currentPlanCode ?? 'Free'}</strong> plan.
      </span>
    )
  } else {
    heading = 'Upgrade your plan'
    subheading = (
      <span style={{ color: '#E67E22' }}>
        {/* limitHitKey message would be passed down from the upgrade context */}
        Upgrade to unlock more capacity and features.
      </span>
    )
  }

  return (
    <div
      style={{
        background: '#F5F5F5',
        minHeight: '100%',
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '32px 24px',
        }}
      >
        {/* Close button for upgrade context */}
        {context === 'upgrade' && onClose && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#9CA3AF',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Heading section */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '28px',
              fontWeight: 700,
              color: '#2E2E2E',
              margin: '0 0 8px',
            }}
          >
            {heading}
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '15px',
              margin: 0,
            }}
          >
            {subheading}
          </p>
        </div>

        {/* Billing toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
          <BillingToggle value={billingCycle} onChange={setBillingCycle} />
        </div>

        {/* Plan cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '24px',
          }}
          className="pricing-grid"
        >
          {isLoading
            ? [1, 2, 3, 4].map((i) => <PlanCardSkeleton key={i} />)
            : plans.map((plan) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  billingCycle={billingCycle}
                  currentPlanCode={currentPlanCode}
                  context={context}
                  isHighlighted={plan.code === 'starter'}
                  limitHitKey={limitHitKey}
                  onSelectPlan={handleSelectPlan}
                  isLoading={checkoutLoading === plan.code}
                />
              ))}
        </div>

        {/* Feature comparison table */}
        <div style={{ marginTop: '64px' }}>
          <FeatureComparisonTable plans={plans} currentPlanCode={currentPlanCode} />
        </div>

        {/* FAQ */}
        <div style={{ marginTop: '64px', maxWidth: '720px', margin: '64px auto 0' }}>
          <PricingFAQ />
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .pricing-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .pricing-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

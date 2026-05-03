'use client'

import { useState, useEffect } from 'react'
import toast, { type Toast } from 'react-hot-toast'
import { CheckCircle } from 'lucide-react'
import type { Plan, BillingCycle, PricingPageProps } from '@/lib/types/billing'
import { getPlans } from '@/lib/api/billing'
import { BillingToggle } from './BillingToggle'
import { PlanCard } from './PlanCard'
import { CheckoutModal } from './CheckoutModal'
import type { SelectedPlan } from './CheckoutModal'
import { FeatureComparisonTable } from './FeatureComparisonTable'
import { PricingFAQ } from './PricingFAQ'

const PLAN_ORDER = ['foundation', 'creator', 'studio', 'enterprise']

const DISPLAY_NAME_FALLBACK: Record<string, string> = {
  free: 'Foundation',
  starter: 'Creator',
  pro: 'Studio',
  enterprise: 'Enterprise',
}

// ---- Success toast ----

interface SuccessToastContent {
  t: Toast
  displayName: string
  orgName?: string
  isDowngrade: boolean
}

function SuccessToastView({ t, displayName, orgName, isDowngrade }: SuccessToastContent) {
  return (
    <div
      onClick={() => toast.dismiss(t.id)}
      style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        background: 'white',
        border: '1px solid #BBF7D0',
        boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        borderRadius: '12px',
        padding: '16px',
        minWidth: '320px',
        maxWidth: '400px',
        cursor: 'pointer',
        opacity: t.visible ? 1 : 0,
        transform: t.visible ? 'translateX(0)' : 'translateX(110%)',
        transition: 'opacity 250ms ease, transform 300ms ease',
      }}
    >
      <div
        style={{
          width: '34px',
          height: '34px',
          background: '#DCFCE7',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <CheckCircle size={18} style={{ color: '#16A34A' }} />
      </div>
      <div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 600,
            color: '#111827',
            marginBottom: '4px',
          }}
        >
          {isDowngrade ? 'Plan updated' : `Welcome to ${displayName}!`}
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#6B7280', lineHeight: '1.5' }}>
          {isDowngrade ? (
            <>
              Your plan has been updated to <strong>{displayName}</strong>.{' '}
              Changes take effect at the end of your current billing period.
            </>
          ) : (
            <>
              {orgName ? <><strong>{orgName}</strong> is</> : 'Your organization is'} now on the{' '}
              <strong>{displayName}</strong> plan.
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function showBillingSuccessToast(content: Omit<SuccessToastContent, 't'>) {
  toast.custom(
    (t) => <SuccessToastView t={t} {...content} />,
    { duration: 5000, position: 'top-right' },
  )
}

function PlanCardSkeleton() {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: '16px',
        padding: '28px',
        height: '480px',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    >
      <div style={{ height: '20px', background: '#F3F4F6', borderRadius: '9999px', width: '40%', marginBottom: '16px' }} />
      <div style={{ height: '28px', background: '#F3F4F6', borderRadius: '6px', width: '70%', marginBottom: '8px' }} />
      <div style={{ height: '14px', background: '#F3F4F6', borderRadius: '6px', width: '90%', marginBottom: '24px' }} />
      <div style={{ height: '40px', background: '#F3F4F6', borderRadius: '6px', width: '50%', marginBottom: '8px' }} />
      <div style={{ height: '12px', background: '#F3F4F6', borderRadius: '6px', width: '65%', marginBottom: '20px' }} />
      <div style={{ height: '1px', background: '#F3F4F6', marginBottom: '20px' }} />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            height: '14px',
            background: '#F3F4F6',
            borderRadius: '6px',
            width: `${55 + i * 6}%`,
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
  orgName,
  limitHitKey,
  onPlanSelected,
  onSuccess,
  onClose,
}: PricingPageProps) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null)

  useEffect(() => {
    getPlans()
      .then((data) => {
        const ordered = PLAN_ORDER.map((code) => data.find((p) => p.code === code)).filter(
          (p): p is Plan => p !== undefined,
        )
        setPlans(ordered)
      })
      .catch(() => {
        // silently fail — skeleton stays until plans load
      })
      .finally(() => setIsLoading(false))
  }, [])

  const currentPlan = plans.find((p) => p.code === currentPlanCode)
  const currentDisplayName =
    currentPlan?.display_name ??
    (currentPlanCode ? DISPLAY_NAME_FALLBACK[currentPlanCode] : null) ??
    'Foundation'

  function handleSelectPlan(planCode: string, cycle: BillingCycle) {
    if (planCode === 'foundation') {
      onPlanSelected?.(planCode, cycle)
      return
    }
    if (planCode === 'enterprise') {
      window.open('mailto:sales@wayfield.app', '_blank')
      return
    }
    if (!orgId) {
      onPlanSelected?.(planCode, cycle)
      return
    }

    const plan = plans.find((p) => p.code === planCode)
    const displayName = plan?.display_name ?? DISPLAY_NAME_FALLBACK[planCode] ?? planCode

    setSelectedPlan({
      code: planCode,
      displayName,
      interval: cycle,
      monthlyCents: plan?.monthly_cents ?? null,
      annualCents: plan?.annual_cents ?? null,
    })
  }

  // Heading by context
  let heading: string
  let subheading: React.ReactNode

  if (context === 'onboarding') {
    heading = 'Choose your plan'
    subheading = <span style={{ color: '#6B7280' }}>Start free and upgrade as you grow.</span>
  } else if (context === 'billing') {
    heading = 'Plans & Pricing'
    subheading = (
      <span style={{ color: '#6B7280' }}>
        Your organization is on the <strong>{currentDisplayName}</strong> plan.
      </span>
    )
  } else {
    heading = 'Upgrade your plan'
    subheading = (
      <span style={{ color: '#E67E22' }}>Upgrade to unlock more capacity and features.</span>
    )
  }

  return (
    <div style={{ background: '#F5F5F5', minHeight: '100%' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Dismiss button for upgrade context */}
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

        {/* Heading */}
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
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', margin: 0 }}>
            {subheading}
          </p>
        </div>

        {/* Billing toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
          <BillingToggle value={billingCycle} onChange={setBillingCycle} />
        </div>

        {/* Plan cards */}
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}
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
                  isHighlighted={plan.code === 'creator'}
                  limitHitKey={limitHitKey}
                  onSelectPlan={handleSelectPlan}
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

      {/* Checkout modal */}
      {selectedPlan && orgId && (
        <CheckoutModal
          selectedPlan={selectedPlan}
          orgId={orgId}
          onSuccess={() => {
            // Snapshot before clearing so toast closure retains values
            const completedPlan = selectedPlan
            const oldIdx = PLAN_ORDER.indexOf(currentPlanCode ?? 'foundation')
            const newIdx = PLAN_ORDER.indexOf(completedPlan.code)
            const isDowngrade = oldIdx > -1 && newIdx > -1 && newIdx < oldIdx

            setSelectedPlan(null)

            showBillingSuccessToast({
              displayName: completedPlan.displayName,
              orgName,
              isDowngrade,
            })

            onSuccess?.()
          }}
          onClose={() => setSelectedPlan(null)}
        />
      )}

      <style>{`
        @media (max-width: 1024px) {
          .pricing-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .pricing-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}

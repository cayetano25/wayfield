'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getOnboardingStatus } from '@/lib/api/auth'
import type { OnboardingIntent } from '@/lib/types/onboarding'
import { OnboardingProgress } from '../../register/components/OnboardingProgress'
import { StepIntent } from './steps/StepIntent'
import { StepJoinWorkshop } from './steps/StepJoinWorkshop'
import { StepCreateOrganization } from './steps/StepCreateOrganization'
import { StepAcceptInvitation } from './steps/StepAcceptInvitation'
import { PricingPage } from '@/components/pricing/PricingPage'
import type { BillingCycle } from '@/lib/types/billing'

// Step encoding:
// 3       = intent selection
// '4a'    = org form (create_organization intent)
// '4b'    = plan selection (create_organization intent)
// 4       = finish step for other intents (join / accept_invitation)
type FlowStep = 3 | '4a' | '4b' | 4

export function OnboardingFlow() {
  const router = useRouter()
  const [step, setStep] = useState<FlowStep>(3)
  const [selectedIntent, setSelectedIntent] = useState<OnboardingIntent | null>(null)
  const [orgId, setOrgId] = useState<number | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)

  useEffect(() => {
    getOnboardingStatus()
      .then((status) => {
        if (status.onboarding_completed) {
          router.replace('/dashboard')
        }
      })
      .catch(() => {
        // If status check fails, continue showing onboarding
      })
      .finally(() => setIsCheckingStatus(false))
  }, [router])

  function handleIntentSelected(intent: OnboardingIntent) {
    setSelectedIntent(intent)

    if (intent === 'exploring') {
      router.push('/dashboard')
      return
    }

    if (intent === 'create_organization') {
      setStep('4a')
    } else {
      setStep(4)
    }
  }

  function handleOrgCreated(id: number) {
    setOrgId(id)
    setStep('4b')
  }

  function handlePlanSelected(planCode: string, _cycle: BillingCycle) {
    if (planCode === 'free') {
      router.push('/dashboard')
    }
    // paid plans: PricingPage handles Stripe checkout redirect internally
  }

  // --- Progress bar values ---
  const isCreateOrgFlow = selectedIntent === 'create_organization' || step === '4a' || step === '4b'
  const totalSteps = isCreateOrgFlow ? 5 : 4
  const stepLabels = isCreateOrgFlow
    ? ['Account', 'Profile', 'Purpose', 'Organization', 'Plan']
    : ['Account', 'Profile', 'Purpose', 'Start']

  let displayStep: number
  if (step === 3) displayStep = 3
  else if (step === '4a') displayStep = 4
  else if (step === '4b') displayStep = 5
  else displayStep = 4 // step === 4

  if (isCheckingStatus) {
    return (
      <div className="w-full flex items-center justify-center" style={{ minHeight: '200px' }}>
        <div
          style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #E5E7EB', borderTopColor: '#0FA3B1', animation: 'spin 0.7s linear infinite' }}
          aria-label="Loading..."
        />
      </div>
    )
  }

  // Plan selection step — rendered as full-screen overlay so PricingPage has room
  if (step === '4b') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'white',
          zIndex: 50,
          overflowY: 'auto',
        }}
      >
        {/* Header with logo + progress */}
        <div
          style={{
            maxWidth: '420px',
            margin: '0 auto',
            padding: '32px 24px 0',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="2" y="6" width="10" height="16" rx="2" fill="#0FA3B1" opacity="0.9"/>
              <rect x="10" y="10" width="10" height="12" rx="2" fill="#0FA3B1" opacity="0.6"/>
              <rect x="16" y="6" width="10" height="16" rx="2" fill="#0FA3B1" opacity="0.9"/>
            </svg>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '26px',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                lineHeight: 1,
              }}
            >
              <span style={{ color: '#2E2E2E' }}>Way</span>
              <span style={{ color: '#0FA3B1' }}>field</span>
            </span>
          </div>

          <OnboardingProgress
            currentStep={displayStep as 5}
            totalSteps={totalSteps}
            stepLabels={stepLabels}
          />
        </div>

        {/* Pricing page — fills remaining width */}
        <PricingPage
          context="onboarding"
          orgId={orgId ?? undefined}
          onPlanSelected={handlePlanSelected}
          onClose={() => setStep('4a')}
        />

        {/* Back link */}
        <div style={{ textAlign: 'center', padding: '0 24px 40px' }}>
          <button
            type="button"
            onClick={() => setStep('4a')}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: '#9CA3AF',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#6B7280')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
          >
            ← Back to organization setup
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Logo */}
      <div className="flex items-center gap-3" style={{ marginBottom: '28px' }}>
        <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="2" y="6" width="10" height="16" rx="2" fill="#0FA3B1" opacity="0.9"/>
          <rect x="10" y="10" width="10" height="12" rx="2" fill="#0FA3B1" opacity="0.6"/>
          <rect x="16" y="6" width="10" height="16" rx="2" fill="#0FA3B1" opacity="0.9"/>
        </svg>
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '26px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}
        >
          <span style={{ color: '#2E2E2E' }}>Way</span>
          <span style={{ color: '#0FA3B1' }}>field</span>
        </span>
      </div>

      <OnboardingProgress
        currentStep={displayStep as 3 | 4}
        totalSteps={totalSteps}
        stepLabels={stepLabels}
      />

      {step === 3 && (
        <StepIntent
          onComplete={handleIntentSelected}
          onBack={() => router.push('/register')}
        />
      )}

      {step === '4a' && (
        <StepCreateOrganization
          onBack={() => { setStep(3); setSelectedIntent(null) }}
          onOrgCreated={handleOrgCreated}
        />
      )}

      {step === 4 && selectedIntent === 'join_workshop' && (
        <StepJoinWorkshop onBack={() => { setStep(3); setSelectedIntent(null) }} />
      )}

      {step === 4 && selectedIntent === 'accept_invitation' && (
        <StepAcceptInvitation onBack={() => { setStep(3); setSelectedIntent(null) }} />
      )}
    </div>
  )
}

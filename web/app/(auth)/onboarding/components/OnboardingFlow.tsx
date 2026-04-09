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

export function OnboardingFlow() {
  const router = useRouter()
  const [step, setStep] = useState<3 | 4>(3)
  const [selectedIntent, setSelectedIntent] = useState<OnboardingIntent | null>(null)
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

    // "exploring" intent skips step 4 and goes straight to dashboard
    if (intent === 'exploring') {
      router.push('/dashboard')
      return
    }

    setStep(4)
  }

  function handleBackToIntent() {
    setStep(3)
    setSelectedIntent(null)
  }

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

  const currentStep = step as 3 | 4

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
            fontFamily: 'var(--font-sora), Sora, sans-serif',
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
        currentStep={currentStep}
        totalSteps={4}
        stepLabels={['Account', 'Profile', 'Purpose', 'Start']}
      />

      {step === 3 && (
        <StepIntent
          onComplete={handleIntentSelected}
          onBack={() => router.push('/register')}
        />
      )}

      {step === 4 && selectedIntent === 'join_workshop' && (
        <StepJoinWorkshop onBack={handleBackToIntent} />
      )}

      {step === 4 && selectedIntent === 'create_organization' && (
        <StepCreateOrganization onBack={handleBackToIntent} />
      )}

      {step === 4 && selectedIntent === 'accept_invitation' && (
        <StepAcceptInvitation onBack={handleBackToIntent} />
      )}
    </div>
  )
}

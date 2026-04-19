'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ApiError } from '@/lib/api/client'
import { registerUser, updateOnboardingProfile } from '@/lib/api/auth'
import type { StepOneData, StepTwoData } from '@/lib/types/onboarding'
import { OnboardingProgress } from './OnboardingProgress'
import { StepAccountBasics } from './steps/StepAccountBasics'
import { StepProfile } from './steps/StepProfile'

export function RegistrationFlow() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<1 | 2>(1)
  const [stepOneData, setStepOneData] = useState<StepOneData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleStepOneComplete(data: StepOneData) {
    setIsLoading(true)
    setError(null)
    try {
      await registerUser(data)
      setStepOneData(data)
      setCurrentStep(2)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422 && err.errors) {
          const field = Object.keys(err.errors)[0]
          setError(err.errors[field]?.[0] ?? err.message)
        } else if (err.status === 409) {
          setError('An account with this email already exists. Try signing in instead.')
        } else {
          setError(err.message || 'Something went wrong. Please try again.')
        }
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleStepTwoComplete(data: StepTwoData) {
    setIsLoading(true)
    setError(null)
    try {
      await updateOnboardingProfile(data)
      router.push('/onboarding')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Something went wrong. Please try again.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  function handleSkipProfile() {
    router.push('/onboarding')
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

      {currentStep === 1 && (
        <StepAccountBasics
          onComplete={handleStepOneComplete}
          defaultValues={stepOneData ?? undefined}
          isLoading={isLoading}
          serverError={error}
        />
      )}

      {currentStep === 2 && (
        <StepProfile
          onComplete={handleStepTwoComplete}
          onBack={() => { setCurrentStep(1); setError(null) }}
          onSkip={handleSkipProfile}
          isLoading={isLoading}
          serverError={error}
        />
      )}
    </div>
  )
}

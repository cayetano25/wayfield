import type { OnboardingStep } from '@/lib/types/onboarding'

interface OnboardingProgressProps {
  currentStep: OnboardingStep
  totalSteps: number
  stepLabels: string[]
}

export function OnboardingProgress({ currentStep, totalSteps, stepLabels }: OnboardingProgressProps) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-start', width: '100%', marginBottom: '28px' }}
      role="list"
      aria-label="Registration progress"
    >
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = (i + 1) as OnboardingStep
        const isCompleted = step < currentStep
        const isActive = step === currentStep
        const isFuture = step > currentStep

        return (
          <div
            key={step}
            role="listitem"
            style={{ display: 'flex', alignItems: 'flex-start', flex: 1 }}
          >
            {/* Step dot + label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div
                aria-current={isActive ? 'step' : undefined}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: isCompleted ? '#0FA3B1' : 'white',
                  border: isCompleted
                    ? 'none'
                    : isActive
                    ? '2px solid #0FA3B1'
                    : '1.5px solid #D1D5DB',
                  transition: 'background 200ms, border-color 200ms',
                }}
              >
                {isCompleted ? (
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span
                    style={{
                      fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: isActive ? '#0FA3B1' : '#9CA3AF',
                      lineHeight: 1,
                    }}
                  >
                    {step}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: isCompleted ? '#0FA3B1' : isActive ? '#2E2E2E' : '#9CA3AF',
                  marginTop: '5px',
                  whiteSpace: 'nowrap',
                  transition: 'color 200ms',
                }}
              >
                {stepLabels[i]}
              </span>
            </div>

            {/* Connector line (not after the last step) */}
            {i < totalSteps - 1 && (
              <div
                aria-hidden="true"
                style={{
                  flex: 1,
                  height: '2px',
                  marginTop: '11px',
                  background: isCompleted ? '#0FA3B1' : '#E5E7EB',
                  transition: 'background 200ms',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

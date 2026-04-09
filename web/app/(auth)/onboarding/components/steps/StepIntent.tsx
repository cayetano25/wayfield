'use client'

import { useState } from 'react'
import { INTENT_OPTIONS, type OnboardingIntent } from '@/lib/types/onboarding'

interface Props {
  onComplete: (intent: OnboardingIntent) => void
  onBack: () => void
}

export function StepIntent({ onComplete, onBack }: Props) {
  const [selected, setSelected] = useState<OnboardingIntent | null>(null)

  return (
    <div className="w-full">
      <h1
        style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '26px', fontWeight: 700, color: '#2E2E2E', lineHeight: 1.2, marginBottom: '6px' }}
      >
        What brings you to Wayfield?
      </h1>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '24px' }}>
        Choose what fits best — you can always do more later.
      </p>

      {/* Intent cards — 2×2 grid on desktop, 1-col on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '12px' }}>
        {INTENT_OPTIONS.map((option) => {
          const isSelected = selected === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelected(option.id)}
              style={{
                border: isSelected ? '2px solid #0FA3B1' : '1.5px solid #E5E7EB',
                borderRadius: '12px',
                padding: '20px',
                cursor: 'pointer',
                textAlign: 'left',
                background: isSelected ? '#F0FDFF' : 'white',
                boxShadow: isSelected ? '0 0 0 3px rgba(15,163,177,0.12)' : 'none',
                transition: 'border-color 150ms, box-shadow 150ms, background 150ms',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#D1D5DB'
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#E5E7EB'
                  e.currentTarget.style.boxShadow = 'none'
                }
              }}
              aria-pressed={isSelected}
            >
              {/* Top row: icon + checkmark */}
              <div className="flex items-center justify-between">
                <span style={{ fontSize: '24px', lineHeight: 1 }} aria-hidden="true">
                  {option.icon}
                </span>
                {isSelected && (
                  <div
                    style={{
                      width: '20px', height: '20px', borderRadius: '9999px',
                      background: '#0FA3B1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    aria-hidden="true"
                  >
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Title */}
              <div style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '15px', fontWeight: 700, color: '#2E2E2E', marginTop: '10px' }}>
                {option.title}
              </div>

              {/* Description */}
              <div style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#6B7280', marginTop: '4px', lineHeight: 1.5 }}>
                {option.description}
              </div>
            </button>
          )
        })}
      </div>

      {/* Continue button */}
      <button
        type="button"
        disabled={!selected}
        onClick={() => { if (selected) onComplete(selected) }}
        className="flex items-center justify-center w-full"
        style={{
          marginTop: '24px',
          height: '44px',
          borderRadius: '8px',
          background: selected ? '#0FA3B1' : '#E5E7EB',
          color: selected ? 'white' : '#9CA3AF',
          fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
          fontSize: '14px',
          fontWeight: 600,
          letterSpacing: '0.02em',
          border: 'none',
          cursor: selected ? 'pointer' : 'not-allowed',
          transition: 'background 150ms, color 150ms',
        }}
        onMouseEnter={(e) => { if (selected) e.currentTarget.style.background = '#0891B2' }}
        onMouseLeave={(e) => { if (selected) e.currentTarget.style.background = '#0FA3B1' }}
      >
        Continue →
      </button>

      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <button
          type="button"
          onClick={onBack}
          style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#6B7280')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
        >
          ← Back to Profile
        </button>
      </div>
    </div>
  )
}

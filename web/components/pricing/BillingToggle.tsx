'use client'

import type { BillingCycle } from '@/lib/types/billing'

interface BillingToggleProps {
  value: BillingCycle
  onChange: (cycle: BillingCycle) => void
}

export function BillingToggle({ value, onChange }: BillingToggleProps) {
  return (
    <div
      style={{
        display: 'inline-flex',
        background: '#F3F4F6',
        borderRadius: '9999px',
        padding: '4px',
      }}
    >
      <button
        type="button"
        onClick={() => onChange('monthly')}
        style={{
          height: '36px',
          padding: '0 20px',
          borderRadius: '9999px',
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          fontWeight: 500,
          border: 'none',
          cursor: 'pointer',
          transition: 'all 200ms ease',
          background: value === 'monthly' ? 'white' : 'transparent',
          color: value === 'monthly' ? '#2E2E2E' : '#6B7280',
          boxShadow: value === 'monthly' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
        }}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange('annual')}
        style={{
          height: '36px',
          padding: '0 20px',
          borderRadius: '9999px',
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          fontWeight: 500,
          border: 'none',
          cursor: 'pointer',
          transition: 'all 200ms ease',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: value === 'annual' ? 'white' : 'transparent',
          color: value === 'annual' ? '#2E2E2E' : '#6B7280',
          boxShadow: value === 'annual' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
        }}
      >
        Annual
        <span
          style={{
            background: '#D1FAE5',
            color: '#065F46',
            fontSize: '10px',
            fontWeight: 600,
            borderRadius: '9999px',
            padding: '2px 8px',
          }}
        >
          Save 15%
        </span>
      </button>
    </div>
  )
}

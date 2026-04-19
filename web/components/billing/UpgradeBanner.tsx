'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AlertTriangle, X } from 'lucide-react'
import type { PlanLimitError } from '@/lib/types/billing'

export function UpgradeBanner() {
  const [error, setError] = useState<PlanLimitError | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    function handlePlanLimit(e: Event) {
      const detail = (e as CustomEvent<PlanLimitError>).detail
      setError(detail)
    }
    window.addEventListener('wayfield:plan_limit_reached', handlePlanLimit)
    return () => window.removeEventListener('wayfield:plan_limit_reached', handlePlanLimit)
  }, [])

  // Auto-dismiss when user navigates to billing
  useEffect(() => {
    if (pathname?.includes('/organization/billing')) {
      setError(null)
    }
  }, [pathname])

  if (!error) return null

  return (
    <div
      role="alert"
      style={{
        background: '#FFFBF5',
        borderBottom: '2px solid #E67E22',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        zIndex: 60,
      }}
    >
      <AlertTriangle size={18} style={{ color: '#E67E22', flexShrink: 0 }} />
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          color: '#92400E',
          flex: 1,
        }}
      >
        {error.message}
      </span>
      <a
        href="/organization/billing#pricing"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          fontWeight: 600,
          color: '#0FA3B1',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Upgrade Plan →
      </a>
      <button
        type="button"
        onClick={() => setError(null)}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <X size={16} style={{ color: '#9CA3AF' }} />
      </button>
    </div>
  )
}

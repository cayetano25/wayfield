'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useNavContext } from '@/lib/hooks/useNavContext'
import type { OrgMembership } from '@/lib/types/nav'

const ROLE_LABELS: Record<string, string> = {
  owner:         'Owner',
  admin:         'Administrator',
  staff:         'Staff',
  billing_admin: 'Billing Admin',
}

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  owner:         { bg: '#1F2937', color: '#ffffff' },
  admin:         { bg: '#CCFBF1', color: '#0F766E' },
  staff:         { bg: '#E0F2FE', color: '#0284C7' },
  billing_admin: { bg: '#FFEDD5', color: '#C2410C' },
}

function OrgCard({ membership }: { membership: OrgMembership }) {
  const badge = ROLE_BADGE[membership.role] ?? { bg: '#F3F4F6', color: '#374151' }

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius:    12,
        border:          '1px solid #E5E7EB',
        padding:         '20px 24px',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        gap:             16,
        boxShadow:       '0 1px 4px rgba(0,0,0,0.05)',
        transition:      'box-shadow 150ms',
      }}
    >
      <div style={{ minWidth: 0 }}>
        {/* Org name */}
        <p style={{
          fontFamily:   'Sora, sans-serif',
          fontSize:     17,
          fontWeight:   700,
          color:        '#2E2E2E',
          margin:       0,
          lineHeight:   1.3,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {membership.organization_name}
        </p>

        {/* Role badge */}
        <span style={{
          display:         'inline-block',
          marginTop:       6,
          padding:         '2px 10px',
          borderRadius:    9999,
          backgroundColor: badge.bg,
          color:           badge.color,
          fontFamily:      'Plus Jakarta Sans, sans-serif',
          fontSize:        11,
          fontWeight:      600,
        }}>
          {ROLE_LABELS[membership.role] ?? membership.role}
        </span>
      </div>

      <Link
        href={`/my-organizations/${membership.organization_slug}`}
        style={{
          flexShrink:      0,
          display:         'inline-flex',
          alignItems:      'center',
          height:          36,
          padding:         '0 16px',
          borderRadius:    8,
          backgroundColor: '#0FA3B1',
          color:           '#ffffff',
          fontFamily:      'Plus Jakarta Sans, sans-serif',
          fontSize:        13,
          fontWeight:      600,
          textDecoration:  'none',
          whiteSpace:      'nowrap',
        }}
      >
        Go to {membership.organization_name}
      </Link>
    </div>
  )
}

export default function MyOrganizationsPage() {
  const nav    = useNavContext()
  const router = useRouter()

  useEffect(() => {
    if (nav.isLoading) return

    if (!nav.isAuthenticated) {
      router.replace('/login')
      return
    }

    // Single org → skip the picker and go straight to the dashboard
    if (nav.memberships.length === 1) {
      router.replace(`/my-organizations/${nav.memberships[0].organization_slug}`)
    }
  }, [nav.isLoading, nav.isAuthenticated, nav.memberships, router])

  // While loading or about to redirect (0 or 1 orgs), show spinner
  if (nav.isLoading || (!nav.isLoading && nav.memberships.length <= 1)) {
    return (
      <div style={{
        minHeight:      'calc(100vh - 56px)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}>
        <div
          style={{
            width:        32,
            height:       32,
            borderRadius: '50%',
            border:       '3px solid #E5E7EB',
            borderTop:    '3px solid #0FA3B1',
            animation:    'spin 0.7s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // No org memberships — shouldn't normally reach here (nav hides the link)
  if (nav.memberships.length === 0) {
    return (
      <div style={{
        maxWidth:   480,
        margin:     '80px auto',
        padding:    '0 24px',
        textAlign:  'center',
      }}>
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize:   15,
          color:      '#6B7280',
        }}>
          You are not a member of any organization.
        </p>
      </div>
    )
  }

  // Multiple orgs — show picker
  return (
    <div style={{
      maxWidth: 600,
      margin:   '48px auto',
      padding:  '0 24px',
    }}>
      {/* Heading */}
      <h1 style={{
        fontFamily:    'Sora, sans-serif',
        fontSize:      22,
        fontWeight:    700,
        color:         '#2E2E2E',
        margin:        '0 0 4px',
        letterSpacing: '-0.01em',
      }}>
        My Organizations
      </h1>
      <p style={{
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize:   14,
        color:      '#6B7280',
        margin:     '0 0 28px',
      }}>
        Choose an organization to manage.
      </p>

      {/* Org cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {nav.memberships.map((m) => (
          <OrgCard key={m.organization_id} membership={m} />
        ))}
      </div>
    </div>
  )
}

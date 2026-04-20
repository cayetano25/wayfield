'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { XCircle, CheckCircle, AlertCircle } from 'lucide-react'
import { resolveOrgInvitation, declineOrgInvitation } from '@/lib/api/invitations'
import { InvitationNotFoundError } from '@/lib/types/invitations'
import { ApiError } from '@/lib/api/client'
import type { OrgInvitationData } from '@/lib/types/invitations'

const cardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: '12px',
  padding: '28px',
  width: '100%',
  border: '1px solid #F3F4F6',
}

function NotFoundState() {
  return (
    <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 28px' }}>
      <XCircle size={40} style={{ color: '#E94F37', margin: '0 auto 16px' }} />
      <h2 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '20px', fontWeight: 700, color: '#2E2E2E', marginBottom: '8px' }}>
        Invitation not found
      </h2>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '24px' }}>
        This link may be invalid or has already been used. Contact the organizer if you believe this is an error.
      </p>
      <Link href="/" style={{ display: 'inline-block', background: '#0FA3B1', color: 'white', padding: '10px 20px', borderRadius: '8px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
        Go to Wayfield →
      </Link>
    </div>
  )
}

function AlreadyDeclinedState() {
  return (
    <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 28px' }}>
      <CheckCircle size={40} style={{ color: '#6B7280', margin: '0 auto 16px' }} />
      <h2 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '20px', fontWeight: 700, color: '#2E2E2E', marginBottom: '8px' }}>
        Invitation already declined
      </h2>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '24px' }}>
        You&apos;ve already declined this invitation.
      </p>
      <Link href="/" style={{ display: 'inline-block', background: '#0FA3B1', color: 'white', padding: '10px 20px', borderRadius: '8px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
        Go to Wayfield →
      </Link>
    </div>
  )
}

function AlreadyAcceptedState({ orgName, roleDisplay }: { orgName: string; roleDisplay: string }) {
  return (
    <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 28px' }}>
      <CheckCircle size={40} style={{ color: '#10B981', margin: '0 auto 16px' }} />
      <h2 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '20px', fontWeight: 700, color: '#2E2E2E', marginBottom: '8px' }}>
        You&apos;ve already accepted this invitation
      </h2>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '24px' }}>
        You&apos;re already a <strong>{roleDisplay}</strong> at {orgName}.
      </p>
      <Link href="/dashboard" style={{ display: 'inline-block', background: '#0FA3B1', color: 'white', padding: '10px 20px', borderRadius: '8px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
        Go to your dashboard →
      </Link>
    </div>
  )
}

function DeclinedConfirmationState({ orgName }: { orgName: string }) {
  return (
    <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 28px', background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          border: '1px solid #E5E7EB',
        }}
      >
        <CheckCircle size={28} style={{ color: '#6B7280' }} />
      </div>
      <h2 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '20px', fontWeight: 700, color: '#2E2E2E', marginBottom: '8px' }}>
        Invitation declined
      </h2>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '24px' }}>
        We&apos;ve let <strong>{orgName}</strong> know. If you change your mind, contact the organizer directly.
      </p>
      <Link href="/" style={{ display: 'inline-block', background: '#0FA3B1', color: 'white', padding: '10px 20px', borderRadius: '8px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
        Go to Wayfield →
      </Link>
    </div>
  )
}

export default function DeclineOrgInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [invitation, setInvitation] = useState<OrgInvitationData | null>(null)
  const [pageState, setPageState] = useState<'loading' | 'not_found' | 'already_accepted' | 'already_declined' | 'pending' | 'success'>('loading')
  const [isDeclining, setIsDeclining] = useState(false)
  const [declineError, setDeclineError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await resolveOrgInvitation(token)
        setInvitation(data)
        if (data.status === 'accepted') {
          setPageState('already_accepted')
        } else if (data.status === 'declined' || data.status === 'removed') {
          setPageState('already_declined')
        } else {
          // pending or expired — can still decline
          setPageState('pending')
        }
      } catch (err) {
        if (err instanceof InvitationNotFoundError) {
          setPageState('not_found')
        } else {
          setPageState('not_found')
        }
      }
    }
    load()
  }, [token])

  async function handleDecline() {
    setIsDeclining(true)
    setDeclineError(null)
    try {
      await declineOrgInvitation(token)
      setPageState('success')
    } catch (err) {
      setDeclineError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsDeclining(false)
    }
  }

  if (pageState === 'loading') {
    return (
      <div className="flex items-center justify-center" style={{ padding: '80px 0' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid #E5E7EB', borderTopColor: '#0FA3B1', animation: 'spin 0.7s linear infinite' }} aria-label="Loading invitation" />
      </div>
    )
  }

  if (pageState === 'not_found') return <NotFoundState />
  if (pageState === 'already_accepted') return <AlreadyAcceptedState orgName={invitation?.organization.name ?? 'the organization'} roleDisplay={invitation?.role_display ?? 'member'} />
  if (pageState === 'already_declined') return <AlreadyDeclinedState />
  if (pageState === 'success') return <DeclinedConfirmationState orgName={invitation?.organization.name ?? 'the organization'} />

  const inv = invitation!

  return (
    <div style={cardStyle}>
      {/* Org badge */}
      <span
        style={{
          display: 'inline-block',
          background: '#F0FDFE',
          color: '#0FA3B1',
          fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
          fontSize: '12px',
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: '9999px',
          border: '1px solid #BAE6FD',
          marginBottom: '16px',
        }}
      >
        {inv.organization.name}
      </span>

      <h1 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '22px', fontWeight: 700, color: '#2E2E2E', marginBottom: '8px', lineHeight: 1.3 }}>
        Decline this invitation?
      </h1>

      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '24px' }}>
        {inv.organization.name} invited you to join as <strong>{inv.role_display}</strong>.
      </p>

      {declineError && (
        <div
          role="alert"
          className="flex items-center gap-2"
          style={{ marginBottom: '16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', color: '#991B1B', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px' }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          {declineError}
        </div>
      )}

      <div className="flex flex-col" style={{ gap: '12px' }}>
        <button
          type="button"
          onClick={handleDecline}
          disabled={isDeclining}
          className="flex items-center justify-center gap-2 w-full"
          style={{
            height: '44px',
            borderRadius: '8px',
            background: 'white',
            color: '#E94F37',
            fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
            fontSize: '14px',
            fontWeight: 600,
            border: '1.5px solid #E94F37',
            cursor: isDeclining ? 'not-allowed' : 'pointer',
            opacity: isDeclining ? 0.7 : 1,
            transition: 'background 150ms, opacity 150ms',
          }}
          onMouseEnter={(e) => { if (!isDeclining) e.currentTarget.style.background = '#FEF2F2' }}
          onMouseLeave={(e) => { if (!isDeclining) e.currentTarget.style.background = 'white' }}
        >
          {isDeclining && (
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(233,79,55,0.3)', borderTopColor: '#E94F37', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
          )}
          {isDeclining ? 'Declining...' : 'Decline Invitation'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <Link
            href={`/org-invitations/${token}/accept`}
            style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#0FA3B1', textDecoration: 'none', fontWeight: 500 }}
          >
            Accept instead →
          </Link>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { XCircle, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { resolveLeaderInvitation, acceptLeaderInvitation } from '@/lib/api/invitations'
import { InvitationNotFoundError } from '@/lib/types/invitations'
import { ApiError } from '@/lib/api/client'
import { InvitationAuthGate } from '../components/InvitationAuthGate'
import { WorkshopPreviewPanel } from '../components/WorkshopPreviewPanel'
import type { LeaderInvitationData } from '@/lib/types/invitations'

// ─── Style helpers ────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: '12px',
  padding: '28px 28px',
  width: '100%',
  border: '1px solid #F3F4F6',
  marginBottom: '16px',
}

// ─── Error states ─────────────────────────────────────────────────────────────

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
      <Link
        href="/"
        style={{ display: 'inline-block', background: '#0FA3B1', color: 'white', padding: '10px 20px', borderRadius: '8px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
      >
        Go to Wayfield →
      </Link>
    </div>
  )
}

function ExpiredState() {
  return (
    <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 28px' }}>
      <Clock size={40} style={{ color: '#E67E22', margin: '0 auto 16px' }} />
      <h2 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '20px', fontWeight: 700, color: '#2E2E2E', marginBottom: '8px' }}>
        This invitation has expired
      </h2>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '24px' }}>
        Invitations are valid for 7 days. Ask the organizer to send a new one.
      </p>
      <Link
        href="/"
        style={{ display: 'inline-block', background: '#0FA3B1', color: 'white', padding: '10px 20px', borderRadius: '8px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
      >
        Go to Wayfield →
      </Link>
    </div>
  )
}

function AlreadyAcceptedState({ orgName }: { orgName: string }) {
  return (
    <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 28px' }}>
      <CheckCircle size={40} style={{ color: '#10B981', margin: '0 auto 16px' }} />
      <h2 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '20px', fontWeight: 700, color: '#2E2E2E', marginBottom: '8px' }}>
        You&apos;ve already accepted this invitation
      </h2>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '24px' }}>
        You&apos;re already a leader at {orgName}.
      </p>
      <Link
        href="/leader/dashboard"
        style={{ display: 'inline-block', background: '#0FA3B1', color: 'white', padding: '10px 20px', borderRadius: '8px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
      >
        Go to your leader dashboard →
      </Link>
    </div>
  )
}

function AlreadyDeclinedState({
  token,
  orgName,
}: {
  token: string
  orgName: string
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleAccept() {
    setIsLoading(true)
    setError(null)
    try {
      await acceptLeaderInvitation(token)
      router.push('/leader/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 28px' }}>
      <XCircle size={40} style={{ color: '#9CA3AF', margin: '0 auto 16px' }} />
      <h2 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '20px', fontWeight: 700, color: '#2E2E2E', marginBottom: '8px' }}>
        You previously declined this invitation
      </h2>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '24px' }}>
        Changed your mind?
      </p>
      {error && (
        <div className="flex items-center justify-center gap-2" style={{ marginBottom: '16px', color: '#E94F37', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px' }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={handleAccept}
        disabled={isLoading}
        style={{ display: 'inline-block', background: '#0FA3B1', color: 'white', padding: '10px 20px', borderRadius: '8px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 600, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}
      >
        {isLoading ? 'Accepting...' : `Accept this invitation → `}
      </button>
      <p style={{ marginTop: '12px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '12px', color: '#9CA3AF' }}>
        at {orgName}
      </p>
    </div>
  )
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessState({ orgName }: { orgName: string }) {
  const router = useRouter()
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    if (countdown <= 0) {
      router.push('/leader/dashboard')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, router])

  return (
    <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 28px', borderColor: '#D1FAE5' }}>
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#ECFDF5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <CheckCircle size={32} style={{ color: '#10B981' }} />
      </div>
      <h2 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '24px', fontWeight: 700, color: '#2E2E2E', marginBottom: '8px' }}>
        Welcome aboard!
      </h2>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '16px' }}>
        You&apos;re now a leader at <strong>{orgName}</strong>.
      </p>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#9CA3AF' }}>
        Redirecting to your dashboard in {countdown} second{countdown !== 1 ? 's' : ''}...
      </p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [invitation, setInvitation] = useState<LeaderInvitationData | null>(null)
  const [pageState, setPageState] = useState<'loading' | 'not_found' | 'expired' | 'accepted' | 'declined' | 'pending'>('loading')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const data = await resolveLeaderInvitation(token)
        setInvitation(data)
        if (data.is_expired) {
          setPageState('expired')
        } else if (data.status === 'accepted') {
          setPageState('accepted')
        } else if (data.status === 'declined') {
          setPageState('declined')
        } else {
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

  const handleAuthenticated = useCallback(() => {
    setIsAuthenticated(true)
  }, [])

  async function handleAccept() {
    setIsAccepting(true)
    setAcceptError(null)
    try {
      await acceptLeaderInvitation(token)
      setIsSuccess(true)
    } catch (err) {
      setAcceptError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsAccepting(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="flex items-center justify-center" style={{ padding: '80px 0' }}>
        <div
          style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid #E5E7EB', borderTopColor: '#0FA3B1', animation: 'spin 0.7s linear infinite' }}
          aria-label="Loading invitation"
        />
      </div>
    )
  }

  // ── Terminal states ──────────────────────────────────────────────────────

  if (pageState === 'not_found') return <NotFoundState />
  if (pageState === 'expired') return <ExpiredState />
  if (pageState === 'accepted') return <AlreadyAcceptedState orgName={invitation?.organization.name ?? 'the organization'} />
  if (pageState === 'declined') return <AlreadyDeclinedState token={token} orgName={invitation?.organization.name ?? 'the organization'} />

  // ── Success ──────────────────────────────────────────────────────────────

  if (isSuccess) {
    return <SuccessState orgName={invitation?.organization.name ?? 'the organization'} />
  }

  // ── Main flow ────────────────────────────────────────────────────────────

  const inv = invitation!

  return (
    <>
      {/* Context card */}
      <div style={cardStyle}>
        <div className="flex items-start gap-3">
          <div>
            <span
              style={{
                display: 'inline-block',
                background: '#F0FDFE',
                color: '#0FA3B1',
                fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '4px 10px',
                borderRadius: '9999px',
                border: '1px solid #BAE6FD',
                marginBottom: '12px',
              }}
            >
              {inv.organization.name}
            </span>

            <h1 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '22px', fontWeight: 700, color: '#2E2E2E', marginBottom: '6px', lineHeight: 1.3 }}>
              You&apos;ve been invited to lead a workshop
            </h1>
            <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: 1.6 }}>
              {inv.organization.name} has invited you to lead sessions on Wayfield.
            </p>
          </div>
        </div>
      </div>

      {/* Auth gate */}
      {!isAuthenticated && (
        <div style={{ ...cardStyle, marginBottom: '16px' }}>
          <InvitationAuthGate
            invitedEmail={inv.invited_email}
            onAuthenticated={handleAuthenticated}
          />
        </div>
      )}

      {/* Confirm section — shown after authentication */}
      {isAuthenticated && (
        <div
          style={{
            ...cardStyle,
            border: '1px solid #BAE6FD',
            background: '#F0FDFE',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '18px', fontWeight: 700, color: '#2E2E2E', marginBottom: '8px' }}>
            Ready to accept?
          </h2>
          <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#4B5563', lineHeight: 1.6, marginBottom: '20px' }}>
            By accepting, you&apos;ll join <strong>{inv.organization.name}</strong> as a leader and gain access to your assigned sessions and participant rosters.
          </p>

          {acceptError && (
            <div
              role="alert"
              className="flex items-center gap-2"
              style={{ marginBottom: '16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', color: '#991B1B', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px' }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              {acceptError}
            </div>
          )}

          <button
            type="button"
            onClick={handleAccept}
            disabled={isAccepting}
            className="flex items-center justify-center gap-2 w-full"
            style={{
              height: '48px',
              borderRadius: '8px',
              background: '#0FA3B1',
              color: 'white',
              fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
              fontSize: '15px',
              fontWeight: 600,
              border: 'none',
              cursor: isAccepting ? 'not-allowed' : 'pointer',
              opacity: isAccepting ? 0.7 : 1,
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => { if (!isAccepting) e.currentTarget.style.background = '#0891B2' }}
            onMouseLeave={(e) => { if (!isAccepting) e.currentTarget.style.background = '#0FA3B1' }}
          >
            {isAccepting && (
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            )}
            {isAccepting ? 'Accepting...' : 'Accept Invitation'}
          </button>

          <p style={{ textAlign: 'center', marginTop: '12px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#6B7280' }}>
            <Link href={`/leader-invitations/${token}/decline`} style={{ color: '#0FA3B1', textDecoration: 'none' }}>
              Decline instead
            </Link>
          </p>
        </div>
      )}

      {/* Workshop preview */}
      <WorkshopPreviewPanel
        workshop={inv.workshop}
        sessions={inv.sessions_assigned}
        organizationName={inv.organization.name}
      />
    </>
  )
}

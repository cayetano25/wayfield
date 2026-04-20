'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { XCircle, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react'
import { resolveOrgInvitation, acceptOrgInvitation, declineOrgInvitation } from '@/lib/api/invitations'
import { InvitationNotFoundError } from '@/lib/types/invitations'
import { ApiError } from '@/lib/api/client'
import { getToken, getStoredUser, clearToken, clearStoredUser } from '@/lib/auth/session'
import { InvitationAuthGate } from '@/app/(invitations)/leader-invitations/[token]/components/InvitationAuthGate'
import type { OrgInvitationData } from '@/lib/types/invitations'

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_KEY = 'pendingOrgInvite'

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  admin:         { bg: '#CCFBF1', color: '#0F766E' },
  staff:         { bg: '#E0F2FE', color: '#0284C7' },
  billing_admin: { bg: '#FFEDD5', color: '#C2410C' },
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin:         'Manage workshops, sessions, leaders, and team members.',
  staff:         'View and manage workshops, sessions, and attendance.',
  billing_admin: 'Manage billing and subscription settings.',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', staff: 'Staff', billing_admin: 'Billing Admin',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeUntilExpiry(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'has expired'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (days > 1) return `in ${days} days`
  if (days === 1) return 'in 1 day'
  if (hours > 1) return `in ${hours} hours`
  return 'soon'
}

// ─── Shared card shell ────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'white',
  borderRadius: '16px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)',
  width: '100%',
  overflow: 'hidden',
}

const sora = 'var(--font-sora), Sora, sans-serif'
const jakarta = 'var(--font-jakarta), Plus Jakarta Sans, sans-serif'

// ─── Wayfield logo ────────────────────────────────────────────────────────────

function WayfieldLogo() {
  return (
    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
      <span
        style={{ fontFamily: sora, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1 }}
      >
        <span style={{ color: '#2E2E2E' }}>Way</span>
        <span style={{ color: '#0FA3B1' }}>field</span>
      </span>
    </div>
  )
}

// ─── Role badge (large) ───────────────────────────────────────────────────────

function LargeRoleBadge({ role }: { role: string }) {
  const style = ROLE_BADGE[role] ?? { bg: '#F3F4F6', color: '#6B7280' }
  const label = ROLE_LABELS[role] ?? role
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 16px',
        borderRadius: '9999px',
        background: style.bg,
        color: style.color,
        fontFamily: jakarta,
        fontSize: '15px',
        fontWeight: 700,
        letterSpacing: '0.01em',
      }}
    >
      {label}
    </span>
  )
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState() {
  return (
    <div style={{ ...card, padding: '48px 32px', textAlign: 'center' }}>
      <WayfieldLogo />
      <XCircle size={48} style={{ color: '#E94F37', margin: '0 auto 20px' }} />
      <h1
        style={{
          fontFamily: sora,
          fontSize: '22px',
          fontWeight: 700,
          color: '#2E2E2E',
          marginBottom: '12px',
          lineHeight: 1.3,
        }}
      >
        Invalid or Expired Invitation
      </h1>
      <p style={{ fontFamily: jakarta, fontSize: '14px', color: '#6B7280', lineHeight: 1.7, marginBottom: '8px' }}>
        This invitation link is no longer valid. It may have already been used, declined, or expired.
      </p>
      <p style={{ fontFamily: jakarta, fontSize: '14px', color: '#6B7280', lineHeight: 1.7 }}>
        Contact the organization administrator for a new invitation.
      </p>
    </div>
  )
}

// ─── Already accepted state ───────────────────────────────────────────────────

function AlreadyAcceptedState({
  orgName,
  roleDisplay,
}: {
  orgName: string
  roleDisplay: string
}) {
  return (
    <div style={{ ...card, padding: '48px 32px', textAlign: 'center' }}>
      <WayfieldLogo />
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#ECFDF5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}
      >
        <CheckCircle size={32} style={{ color: '#10B981' }} />
      </div>
      <h1 style={{ fontFamily: sora, fontSize: '22px', fontWeight: 700, color: '#2E2E2E', marginBottom: '10px', lineHeight: 1.3 }}>
        You&apos;re already a member
      </h1>
      <p style={{ fontFamily: jakarta, fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '28px' }}>
        You already have <strong>{roleDisplay}</strong> access to <strong>{orgName}</strong>.
      </p>
      <Link
        href="/dashboard"
        style={{
          display: 'inline-block',
          background: '#0FA3B1',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          fontFamily: jakarta,
          fontSize: '14px',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Go to your dashboard →
      </Link>
    </div>
  )
}

// ─── Accept success state ─────────────────────────────────────────────────────

function AcceptSuccessState({
  orgName,
  roleDisplay,
  redirectTo,
}: {
  orgName: string
  roleDisplay: string
  redirectTo: string
}) {
  const router = useRouter()
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    if (countdown <= 0) {
      router.push(redirectTo)
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, redirectTo, router])

  return (
    <div style={{ ...card, padding: '48px 32px', textAlign: 'center', border: '1.5px solid #D1FAE5' }}>
      <WayfieldLogo />
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#ECFDF5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}
      >
        <CheckCircle size={32} style={{ color: '#10B981' }} />
      </div>
      <h1 style={{ fontFamily: sora, fontSize: '24px', fontWeight: 700, color: '#2E2E2E', marginBottom: '8px' }}>
        Welcome to {orgName}!
      </h1>
      <p style={{ fontFamily: jakarta, fontSize: '14px', color: '#4B5563', lineHeight: 1.6, marginBottom: '16px' }}>
        You are now a <strong>{roleDisplay}</strong>.
      </p>
      <p style={{ fontFamily: jakarta, fontSize: '13px', color: '#9CA3AF' }}>
        Redirecting in {countdown} second{countdown !== 1 ? 's' : ''}…
      </p>
    </div>
  )
}

// ─── Decline success state ────────────────────────────────────────────────────

function DeclineSuccessState({ orgName }: { orgName: string }) {
  return (
    <div style={{ ...card, padding: '48px 32px', textAlign: 'center' }}>
      <WayfieldLogo />
      <XCircle size={40} style={{ color: '#9CA3AF', margin: '0 auto 20px' }} />
      <h1 style={{ fontFamily: sora, fontSize: '22px', fontWeight: 700, color: '#2E2E2E', marginBottom: '10px' }}>
        Invitation declined
      </h1>
      <p style={{ fontFamily: jakarta, fontSize: '14px', color: '#6B7280', lineHeight: 1.6 }}>
        We&apos;ve let <strong>{orgName}</strong> know. If you change your mind, contact the organizer directly.
      </p>
    </div>
  )
}

// ─── Email mismatch warning ───────────────────────────────────────────────────

function EmailMismatchWarning({
  invitedEmail,
  currentEmail,
}: {
  invitedEmail: string
  currentEmail: string
}) {
  function handleSignOut() {
    clearToken()
    clearStoredUser()
    window.location.reload()
  }

  return (
    <div
      style={{
        background: '#FFFBEB',
        border: '1px solid #FDE68A',
        borderRadius: '10px',
        padding: '16px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <AlertTriangle size={18} style={{ color: '#E67E22', flexShrink: 0, marginTop: '2px' }} />
        <div>
          <p style={{ fontFamily: jakarta, fontSize: '13px', fontWeight: 600, color: '#92400E', marginBottom: '6px' }}>
            Wrong account
          </p>
          <p style={{ fontFamily: jakarta, fontSize: '13px', color: '#92400E', lineHeight: 1.6, margin: 0 }}>
            This invitation was sent to <strong>{invitedEmail}</strong>.<br />
            You are signed in as <strong>{currentEmail}</strong>.<br />
            Please sign in with the correct account to accept.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              marginTop: '14px',
              height: '36px',
              padding: '0 16px',
              borderRadius: '8px',
              border: '1.5px solid #0FA3B1',
              background: 'transparent',
              color: '#0FA3B1',
              fontFamily: jakarta,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F0FDFE' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            Sign In with a Different Account
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Accept + Decline action section ─────────────────────────────────────────

type DeclineStep = 'idle' | 'confirming' | 'declining'

function AcceptDeclineSection({
  orgName,
  onAccept,
  onDecline,
  isAccepting,
  acceptError,
}: {
  orgName: string
  onAccept: () => void
  onDecline: () => Promise<void>
  isAccepting: boolean
  acceptError: string | null
}) {
  const [declineStep, setDeclineStep] = useState<DeclineStep>('idle')

  return (
    <div>
      {acceptError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            marginBottom: '16px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '10px 14px',
          }}
        >
          <AlertCircle size={14} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
          <span style={{ fontFamily: jakarta, fontSize: '13px', color: '#991B1B', lineHeight: 1.5 }}>
            {acceptError}
          </span>
        </div>
      )}

      {declineStep === 'idle' && (
        <>
          <button
            type="button"
            onClick={onAccept}
            disabled={isAccepting}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              height: '48px',
              borderRadius: '8px',
              background: '#0FA3B1',
              color: 'white',
              fontFamily: jakarta,
              fontSize: '15px',
              fontWeight: 600,
              border: 'none',
              cursor: isAccepting ? 'not-allowed' : 'pointer',
              opacity: isAccepting ? 0.7 : 1,
              transition: 'background 150ms',
              marginBottom: '14px',
            }}
            onMouseEnter={(e) => { if (!isAccepting) e.currentTarget.style.background = '#0891B2' }}
            onMouseLeave={(e) => { if (!isAccepting) e.currentTarget.style.background = '#0FA3B1' }}
          >
            {isAccepting && (
              <div
                style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite', flexShrink: 0 }}
              />
            )}
            {isAccepting ? 'Accepting…' : 'Accept Invitation'}
          </button>

          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setDeclineStep('confirming')}
              style={{ fontFamily: jakarta, fontSize: '13px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#6B7280' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF' }}
            >
              Decline
            </button>
          </div>
        </>
      )}

      {(declineStep === 'confirming' || declineStep === 'declining') && (
        <div
          style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '10px',
            padding: '16px 20px',
          }}
        >
          <p style={{ fontFamily: jakarta, fontSize: '14px', fontWeight: 600, color: '#991B1B', marginBottom: '6px' }}>
            Decline this invitation?
          </p>
          <p style={{ fontFamily: jakarta, fontSize: '13px', color: '#B91C1C', marginBottom: '16px' }}>
            This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={async () => {
                setDeclineStep('declining')
                await onDecline()
              }}
              disabled={declineStep === 'declining'}
              style={{
                flex: 1,
                height: '40px',
                borderRadius: '8px',
                background: '#E94F37',
                color: 'white',
                fontFamily: jakarta,
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: declineStep === 'declining' ? 'not-allowed' : 'pointer',
                opacity: declineStep === 'declining' ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              {declineStep === 'declining' && (
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
              )}
              {declineStep === 'declining' ? 'Declining…' : 'Yes, Decline'}
            </button>
            <button
              type="button"
              onClick={() => setDeclineStep('idle')}
              disabled={declineStep === 'declining'}
              style={{
                flex: 1,
                height: '40px',
                borderRadius: '8px',
                background: 'transparent',
                color: '#0FA3B1',
                fontFamily: jakarta,
                fontSize: '14px',
                fontWeight: 600,
                border: '1.5px solid #0FA3B1',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#F0FDFE' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Go Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Auth section dispatcher ──────────────────────────────────────────────────

type AuthState = 'detecting' | 'unauthenticated' | 'mismatch' | 'authenticated'

function AuthSection({
  invitedEmail,
  token,
  onAuthenticated,
  onAccept,
  onDecline,
  isAccepting,
  acceptError,
  orgName,
}: {
  invitedEmail: string
  token: string
  onAuthenticated: () => void
  onAccept: () => void
  onDecline: () => Promise<void>
  isAccepting: boolean
  acceptError: string | null
  orgName: string
}) {
  const [authState, setAuthState] = useState<AuthState>('detecting')
  const [mismatchEmail, setMismatchEmail] = useState<string | null>(null)

  useEffect(() => {
    const storedToken = getToken()
    const storedUser = getStoredUser()

    if (!storedToken || !storedUser) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SESSION_KEY, token)
      }
      setAuthState('unauthenticated')
      return
    }

    if (storedUser.email.toLowerCase() === invitedEmail.toLowerCase()) {
      setAuthState('authenticated')
      onAuthenticated()
    } else {
      setMismatchEmail(storedUser.email)
      setAuthState('mismatch')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitedEmail])

  if (authState === 'detecting') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #E5E7EB', borderTopColor: '#0FA3B1', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  if (authState === 'mismatch' && mismatchEmail) {
    return (
      <EmailMismatchWarning
        invitedEmail={invitedEmail}
        currentEmail={mismatchEmail}
      />
    )
  }

  if (authState === 'unauthenticated') {
    return (
      <div
        style={{
          background: '#F9FAFB',
          border: '1px solid #E5E7EB',
          borderRadius: '10px',
          padding: '20px',
        }}
      >
        <InvitationAuthGate
          invitedEmail={invitedEmail}
          onAuthenticated={() => {
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem(SESSION_KEY)
            }
            setAuthState('authenticated')
            onAuthenticated()
          }}
        />
      </div>
    )
  }

  // authenticated + matching email
  return (
    <AcceptDeclineSection
      orgName={orgName}
      onAccept={onAccept}
      onDecline={onDecline}
      isAccepting={isAccepting}
      acceptError={acceptError}
    />
  )
}

// ─── Main invitation card ─────────────────────────────────────────────────────

function InvitationCard({
  inv,
  token,
}: {
  inv: OrgInvitationData
  token: string
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<{ orgName: string; roleDisplay: string; redirectTo: string } | null>(null)
  const [declined, setDeclined] = useState(false)

  const handleAuthenticated = useCallback(() => {
    setIsAuthenticated(true)
  }, [])

  async function handleAccept() {
    setIsAccepting(true)
    setAcceptError(null)
    try {
      const result = await acceptOrgInvitation(token)
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(SESSION_KEY)
      }
      setSuccessData({
        orgName: result.organization?.name ?? inv.organization.name,
        roleDisplay: result.role_display ?? inv.role_display,
        redirectTo: result.redirect ?? '/dashboard',
      })
    } catch (err) {
      if (err instanceof ApiError) {
        setAcceptError(err.message)
      } else {
        setAcceptError('Something went wrong. Please try again.')
      }
    } finally {
      setIsAccepting(false)
    }
  }

  async function handleDecline() {
    await declineOrgInvitation(token)
    setDeclined(true)
  }

  if (successData) {
    return (
      <AcceptSuccessState
        orgName={successData.orgName}
        roleDisplay={successData.roleDisplay}
        redirectTo={successData.redirectTo}
      />
    )
  }

  if (declined) {
    return <DeclineSuccessState orgName={inv.organization.name} />
  }

  const roleDesc = ROLE_DESCRIPTIONS[inv.role]
  const expiresLabel = inv.expires_at ? timeUntilExpiry(inv.expires_at) : null

  return (
    <div style={card}>
      <div style={{ padding: '32px 32px 28px' }}>
        <WayfieldLogo />

        {/* Org name */}
        <h1
          style={{
            fontFamily: sora,
            fontSize: '20px',
            fontWeight: 700,
            color: '#2E2E2E',
            textAlign: 'center',
            marginBottom: '24px',
            lineHeight: 1.3,
          }}
        >
          {inv.organization.name}
        </h1>

        {/* Role block */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p
            style={{
              fontFamily: jakarta,
              fontSize: '14px',
              color: '#6B7280',
              marginBottom: '12px',
              lineHeight: 1.6,
            }}
          >
            You have been invited to join <strong style={{ color: '#2E2E2E' }}>{inv.organization.name}</strong> as:
          </p>
          <LargeRoleBadge role={inv.role} />
          {roleDesc && (
            <p
              style={{
                fontFamily: jakarta,
                fontSize: '13px',
                color: '#6B7280',
                marginTop: '10px',
                lineHeight: 1.6,
              }}
            >
              {roleDesc}
            </p>
          )}
        </div>

        {/* Divider */}
        <hr style={{ border: 'none', borderTop: '1px solid #F3F4F6', margin: '0 0 20px' }} />

        {/* Invited to */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '24px',
          }}
        >
          <span style={{ fontFamily: jakarta, fontSize: '12px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
            Invited to:
          </span>
          <span style={{ fontFamily: jakarta, fontSize: '13px', color: '#2E2E2E', fontWeight: 500, wordBreak: 'break-all' }}>
            {inv.invited_email}
          </span>
        </div>

        {/* Auth / action section */}
        <AuthSection
          invitedEmail={inv.invited_email}
          token={token}
          onAuthenticated={handleAuthenticated}
          onAccept={handleAccept}
          onDecline={handleDecline}
          isAccepting={isAccepting}
          acceptError={acceptError}
          orgName={inv.organization.name}
        />
      </div>

      {/* Expiry note */}
      {expiresLabel && (
        <div
          style={{
            padding: '14px 32px',
            borderTop: '1px solid #F3F4F6',
            background: '#FAFAFA',
          }}
        >
          <p style={{ fontFamily: jakarta, fontSize: '12px', color: '#9CA3AF', textAlign: 'center', margin: 0 }}>
            This invitation expires {expiresLabel}.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageState = 'loading' | 'error' | 'already_accepted' | 'pending'

export default function AcceptOrgInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [invitation, setInvitation] = useState<OrgInvitationData | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')

  // Set noindex for invitation pages
  useEffect(() => {
    const existing = document.querySelector('meta[name="robots"]')
    if (!existing) {
      const meta = document.createElement('meta')
      meta.name = 'robots'
      meta.content = 'noindex'
      document.head.appendChild(meta)
      return () => { document.head.removeChild(meta) }
    }
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const data = await resolveOrgInvitation(token)
        setInvitation(data)
        if (data.status === 'accepted') {
          setPageState('already_accepted')
        } else if (data.is_expired || data.status === 'removed' || data.status === 'declined') {
          setPageState('error')
        } else {
          setPageState('pending')
        }
      } catch (err) {
        if (err instanceof InvitationNotFoundError) {
          setPageState('error')
        } else {
          setPageState('error')
        }
      }
    }
    load()
  }, [token])

  if (pageState === 'loading') {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '3px solid #E5E7EB',
            borderTopColor: '#0FA3B1',
            animation: 'spin 0.7s linear infinite',
          }}
          aria-label="Loading invitation"
        />
      </div>
    )
  }

  if (pageState === 'error') {
    return <ErrorState />
  }

  if (pageState === 'already_accepted') {
    return (
      <AlreadyAcceptedState
        orgName={invitation?.organization.name ?? 'the organization'}
        roleDisplay={invitation?.role_display ?? 'member'}
      />
    )
  }

  return <InvitationCard inv={invitation!} token={token} />
}

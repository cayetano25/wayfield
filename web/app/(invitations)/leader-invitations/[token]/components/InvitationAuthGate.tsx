'use client'

import { useState, useEffect, type FormEvent } from 'react'
import Link from 'next/link'
import { Lock, Eye, EyeOff, AlertCircle, AlertTriangle, User } from 'lucide-react'
import { ApiError, apiPost } from '@/lib/api/client'
import { getToken, getStoredUser, setToken, setStoredUser, clearToken, clearStoredUser, type AdminUser } from '@/lib/auth/session'
import { checkEmailExists } from '@/lib/api/invitations'

interface Props {
  invitedEmail: string
  onAuthenticated: () => void
}

type Scenario = 'loading' | 'mismatch' | 'login' | 'register'

// --- Style helpers ------------------------------------------------------------

const inputBaseStyle: React.CSSProperties = {
  width: '100%',
  height: '44px',
  padding: '11px 16px 11px 42px',
  borderRadius: '8px',
  fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
  fontSize: '14px',
  color: '#2E2E2E',
  outline: 'none',
  transition: 'border-color 150ms, box-shadow 150ms',
  background: 'white',
}

function getInputStyle(hasError: boolean, focused: boolean): React.CSSProperties {
  if (hasError) return { ...inputBaseStyle, border: '1px solid #E94F37', boxShadow: '0 0 0 3px rgba(233,79,55,0.10)' }
  if (focused) return { ...inputBaseStyle, border: '1px solid #0FA3B1', boxShadow: '0 0 0 3px rgba(15,163,177,0.12)' }
  return { ...inputBaseStyle, border: '1px solid #E5E7EB' }
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
  fontSize: '11px',
  fontWeight: 600,
  color: '#374151',
  letterSpacing: '0.06em',
  marginBottom: '6px',
}

// --- Password strength --------------------------------------------------------

function getPasswordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0
  if (password.length < 8) return 1
  const hasMixed = /[A-Z]/.test(password) && /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  if (hasMixed && hasNumber) return 4
  if (hasMixed || hasNumber) return 3
  return 2
}

const STRENGTH_COLORS = ['#E5E7EB', '#E94F37', '#F97316', '#F59E0B', '#10B981']
const STRENGTH_LABELS = ['', 'Too short', 'Weak', 'Almost there', 'Strong']

// --- Shared: read-only email pill ---------------------------------------------

function EmailPill({ label, email }: { label: string; email: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: '#F9FAFB',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '10px 14px',
        marginBottom: '20px',
      }}
    >
      <Lock size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} aria-hidden="true" />
      <span style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#6B7280' }}>
        {label}:{' '}
        <strong style={{ color: '#2E2E2E' }}>{email}</strong>
      </span>
    </div>
  )
}

// --- Shared: field error ------------------------------------------------------

function FieldError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-1"
      style={{ marginTop: '4px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '12px', color: '#E94F37' }}
    >
      <AlertCircle size={12} aria-hidden="true" />
      {message}
    </div>
  )
}

// --- Shared: form error banner ------------------------------------------------

function FormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2"
      style={{
        marginBottom: '16px',
        background: '#FEF2F2',
        border: '1px solid #FECACA',
        borderRadius: '8px',
        padding: '10px 14px',
      }}
    >
      <AlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
      <span style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#991B1B' }}>
        {message}
      </span>
    </div>
  )
}

// --- Shared: primary button ---------------------------------------------------

function PrimaryButton({
  isLoading,
  label,
  loadingLabel,
}: {
  isLoading: boolean
  label: string
  loadingLabel: string
}) {
  return (
    <button
      type="submit"
      disabled={isLoading}
      className="flex items-center justify-center gap-2 w-full"
      style={{
        marginTop: '24px',
        height: '48px',
        borderRadius: '8px',
        background: '#0FA3B1',
        color: 'white',
        fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
        fontSize: '14px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        border: 'none',
        cursor: isLoading ? 'not-allowed' : 'pointer',
        opacity: isLoading ? 0.7 : 1,
        transition: 'background 150ms, opacity 150ms',
      }}
      onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.background = '#0891B2' }}
      onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.background = '#0FA3B1' }}
      onMouseDown={(e) => { if (!isLoading) e.currentTarget.style.background = '#0E7490' }}
      onMouseUp={(e) => { if (!isLoading) e.currentTarget.style.background = '#0891B2' }}
    >
      {isLoading && (
        <div
          style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite', flexShrink: 0 }}
          aria-hidden="true"
        />
      )}
      {isLoading ? loadingLabel : label}
    </button>
  )
}

// --- Scenario A: Register -----------------------------------------------------

function RegisterForm({
  invitedEmail,
  defaultFirstName,
  defaultLastName,
  onAuthenticated,
  onSwitchToLogin,
}: {
  invitedEmail: string
  defaultFirstName: string | null
  defaultLastName: string | null
  onAuthenticated: () => void
  onSwitchToLogin: () => void
}) {
  const [firstName, setFirstName] = useState(defaultFirstName ?? '')
  const [lastName, setLastName] = useState(defaultLastName ?? '')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [focused, setFocused] = useState<Record<string, boolean>>({})

  function touch(field: string) {
    setTouched((p) => ({ ...p, [field]: true }))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!firstName.trim()) e.first_name = 'First name is required.'
    if (!lastName.trim()) e.last_name = 'Last name is required.'
    if (!password) e.password = 'Password is required.'
    else if (password.length < 8) e.password = 'Min 8 characters, at least one uppercase letter and one number.'
    if (!passwordConfirmation) e.password_confirmation = 'Please confirm your password.'
    else if (password !== passwordConfirmation) e.password_confirmation = 'Passwords do not match.'
    if (!termsAccepted) e.terms = 'Please accept the terms to continue.'
    return e
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched({ first_name: true, last_name: true, password: true, password_confirmation: true, terms: true })
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setIsLoading(true)
    setFormError(null)

    try {
      const res = await apiPost<{ token: string; user: AdminUser }>('/auth/register', {
        first_name: firstName,
        last_name: lastName,
        email: invitedEmail,
        password,
        password_confirmation: passwordConfirmation,
      })
      setToken(res.token)
      setStoredUser(res.user)
      onAuthenticated()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422 && err.errors) {
          const fieldErrors: Record<string, string> = {}
          for (const [key, msgs] of Object.entries(err.errors)) {
            fieldErrors[key] = msgs[0]
          }
          setErrors(fieldErrors)
        } else {
          setFormError(err.message || 'Something went wrong. Please try again.')
        }
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const strength = getPasswordStrength(password)

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '22px', fontWeight: 700, color: '#2E2E2E', marginBottom: '4px' }}>
        Create your Wayfield account to accept
      </h2>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', marginBottom: '20px' }}>
        You'll be set up in less than a minute.
      </p>

      <EmailPill label="Invited as" email={invitedEmail} />

      {formError && <FormError message={formError} />}

      <form onSubmit={handleSubmit} noValidate>
        {/* Name row */}
        <div className="grid grid-cols-2" style={{ gap: '12px' }}>
          <div>
            <label style={labelStyle}>FIRST NAME</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} aria-hidden="true" />
              <input
                type="text"
                autoComplete="given-name"
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onBlur={() => { touch('first_name'); setFocused((p) => ({ ...p, first_name: false })) }}
                onFocus={() => setFocused((p) => ({ ...p, first_name: true }))}
                style={getInputStyle(Boolean(touched.first_name && errors.first_name), Boolean(focused.first_name))}
              />
            </div>
            {touched.first_name && errors.first_name && <FieldError message={errors.first_name} />}
          </div>
          <div>
            <label style={labelStyle}>LAST NAME</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} aria-hidden="true" />
              <input
                type="text"
                autoComplete="family-name"
                placeholder="Appleseed"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onBlur={() => { touch('last_name'); setFocused((p) => ({ ...p, last_name: false })) }}
                onFocus={() => setFocused((p) => ({ ...p, last_name: true }))}
                style={getInputStyle(Boolean(touched.last_name && errors.last_name), Boolean(focused.last_name))}
              />
            </div>
            {touched.last_name && errors.last_name && <FieldError message={errors.last_name} />}
          </div>
        </div>

        {/* Password */}
        <div style={{ marginTop: '20px' }}>
          <label style={labelStyle}>PASSWORD</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} aria-hidden="true" />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => { touch('password'); setFocused((p) => ({ ...p, password: false })) }}
              onFocus={() => setFocused((p) => ({ ...p, password: true }))}
              style={{ ...getInputStyle(Boolean(touched.password && errors.password), Boolean(focused.password)), paddingRight: '42px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6B7280' }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {password.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div className="flex gap-1" aria-hidden="true">
                {[1, 2, 3, 4].map((seg) => (
                  <div key={seg} style={{ flex: 1, height: '3px', borderRadius: '9999px', background: seg <= strength ? STRENGTH_COLORS[strength] : '#E5E7EB', transition: 'background 200ms' }} />
                ))}
              </div>
              {strength > 0 && (
                <span style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '11px', color: STRENGTH_COLORS[strength], marginTop: '3px', display: 'block' }}>
                  {STRENGTH_LABELS[strength]}
                </span>
              )}
            </div>
          )}
          <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '12px', color: '#9CA3AF', marginTop: '5px' }}>
            Min 8 characters, at least one uppercase letter and one number.
          </p>
          {touched.password && errors.password && <FieldError message={errors.password} />}
        </div>

        {/* Confirm password */}
        <div style={{ marginTop: '20px' }}>
          <label style={labelStyle}>CONFIRM PASSWORD</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} aria-hidden="true" />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              onBlur={() => { touch('password_confirmation'); setFocused((p) => ({ ...p, confirm: false })) }}
              onFocus={() => setFocused((p) => ({ ...p, confirm: true }))}
              style={getInputStyle(Boolean(touched.password_confirmation && errors.password_confirmation), Boolean(focused.confirm))}
            />
          </div>
          {touched.password_confirmation && errors.password_confirmation && <FieldError message={errors.password_confirmation} />}
        </div>

        {/* Terms */}
        <div style={{ marginTop: '20px' }}>
          <label className="flex items-start gap-3" style={{ cursor: 'pointer' }}>
            <div
              role="checkbox"
              aria-checked={termsAccepted}
              tabIndex={0}
              onClick={() => setTermsAccepted((v) => !v)}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setTermsAccepted((v) => !v) } }}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                border: termsAccepted ? 'none' : touched.terms && errors.terms ? '1.5px solid #E94F37' : '1.5px solid #D1D5DB',
                background: termsAccepted ? '#0FA3B1' : 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: 'pointer',
                marginTop: '1px',
                transition: 'background 150ms, border-color 150ms',
              }}
            >
              {termsAccepted && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#4B5563', lineHeight: 1.5, userSelect: 'none' }}>
              I agree to Wayfield&apos;s{' '}
              <a href="#" style={{ color: '#0FA3B1', textDecoration: 'none' }}>Terms of Service</a>
              {' '}and{' '}
              <a href="#" style={{ color: '#0FA3B1', textDecoration: 'none' }}>Privacy Policy</a>
            </span>
          </label>
          {touched.terms && errors.terms && <FieldError message={errors.terms} />}
        </div>

        <PrimaryButton isLoading={isLoading} label="Create Account & Accept →" loadingLabel="Creating account..." />
      </form>

      <p style={{ textAlign: 'center', marginTop: '20px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#6B7280' }}>
        Already have a Wayfield account?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          style={{ color: '#0FA3B1', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 'inherit' }}
        >
          Sign in instead →
        </button>
      </p>
    </div>
  )
}

// --- Scenario B: Login --------------------------------------------------------

function LoginForm({
  invitedEmail,
  onAuthenticated,
  onSwitchToRegister,
}: {
  invitedEmail: string
  onAuthenticated: () => void
  onSwitchToRegister: () => void
}) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)
  const [focused, setFocused] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!password) { setFormError('Password is required.'); return }
    setIsLoading(true)
    setFormError(null)

    try {
      const res = await apiPost<{ token: string; user: AdminUser }>('/auth/login', {
        email: invitedEmail,
        password,
        platform: 'web',
      })
      setToken(res.token)
      setStoredUser(res.user)
      onAuthenticated()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFormError('Incorrect password. Try again.')
      } else if (err instanceof ApiError) {
        setFormError(err.message || 'Something went wrong. Please try again.')
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '22px', fontWeight: 700, color: '#2E2E2E', marginBottom: '4px' }}>
        Sign in to accept this invitation
      </h2>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', marginBottom: '20px' }}>
        Use the email this invitation was sent to.
      </p>

      <EmailPill label="Signing in as" email={invitedEmail} />

      {formError && <FormError message={formError} />}

      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label style={labelStyle}>PASSWORD</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} aria-hidden="true" />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setFocused(false)}
              onFocus={() => setFocused(true)}
              style={{ ...getInputStyle(Boolean(touched && !password), focused), paddingRight: '42px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6B7280' }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div style={{ marginTop: '10px', textAlign: 'right' }}>
          <Link href="/forgot-password" style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#0FA3B1', textDecoration: 'none' }}>
            Forgot your password? →
          </Link>
        </div>

        <PrimaryButton isLoading={isLoading} label="Sign In & Accept →" loadingLabel="Signing in..." />
      </form>

      <p style={{ textAlign: 'center', marginTop: '20px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#6B7280' }}>
        Need a new account?{' '}
        <button
          type="button"
          onClick={onSwitchToRegister}
          style={{ color: '#0FA3B1', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 'inherit' }}
        >
          Sign up instead →
        </button>
      </p>
    </div>
  )
}

// --- Email Mismatch State -----------------------------------------------------

function EmailMismatch({
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
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} style={{ color: '#E67E22', flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 600, color: '#92400E', marginBottom: '6px' }}>
            Signed in as a different account
          </p>
          <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#92400E', lineHeight: 1.6 }}>
            This invitation was sent to <strong>{invitedEmail}</strong>.<br />
            You&apos;re currently signed in as <strong>{currentEmail}</strong>.<br />
            Please sign out and use the invited email address, or ask the organizer to resend the invitation to your current email.
          </p>

          <div className="flex items-center gap-3" style={{ marginTop: '16px' }}>
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                height: '36px',
                padding: '0 16px',
                borderRadius: '8px',
                border: '1px solid #D97706',
                background: 'white',
                color: '#92400E',
                fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
            <a
              href="/admin/dashboard"
              style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#92400E', textDecoration: 'none' }}
            >
              Go to Dashboard →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Main component -----------------------------------------------------------

export function InvitationAuthGate({ invitedEmail, onAuthenticated }: Props) {
  const [scenario, setScenario] = useState<Scenario>('loading')
  const [mismatchEmail, setMismatchEmail] = useState<string | null>(null)
  const [defaultFirstName, setDefaultFirstName] = useState<string | null>(null)
  const [defaultLastName, setDefaultLastName] = useState<string | null>(null)

  useEffect(() => {
    async function detect() {
      const token = getToken()
      const storedUser = getStoredUser()

      if (token && storedUser) {
        if (storedUser.email.toLowerCase() === invitedEmail.toLowerCase()) {
          onAuthenticated()
        } else {
          setMismatchEmail(storedUser.email)
          setScenario('mismatch')
        }
        return
      }

      const exists = await checkEmailExists(invitedEmail)
      setScenario(exists ? 'login' : 'register')
    }

    detect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitedEmail])

  if (scenario === 'loading') {
    return (
      <div className="flex items-center justify-center" style={{ padding: '32px 0' }}>
        <div
          style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #E5E7EB', borderTopColor: '#0FA3B1', animation: 'spin 0.7s linear infinite' }}
          aria-label="Loading"
        />
      </div>
    )
  }

  if (scenario === 'mismatch' && mismatchEmail) {
    return <EmailMismatch invitedEmail={invitedEmail} currentEmail={mismatchEmail} />
  }

  if (scenario === 'register') {
    return (
      <RegisterForm
        invitedEmail={invitedEmail}
        defaultFirstName={defaultFirstName}
        defaultLastName={defaultLastName}
        onAuthenticated={onAuthenticated}
        onSwitchToLogin={() => setScenario('login')}
      />
    )
  }

  return (
    <LoginForm
      invitedEmail={invitedEmail}
      onAuthenticated={onAuthenticated}
      onSwitchToRegister={() => { setScenario('register'); setDefaultFirstName(null); setDefaultLastName(null) }}
    />
  )
}

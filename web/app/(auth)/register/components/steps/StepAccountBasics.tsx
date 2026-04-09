'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, AlertCircle, User } from 'lucide-react'
import type { StepOneData } from '@/lib/types/onboarding'

interface Props {
  onComplete: (data: StepOneData) => Promise<void>
  defaultValues?: Partial<StepOneData>
  isLoading: boolean
  serverError: string | null
}

interface FormErrors {
  first_name?: string
  last_name?: string
  email?: string
  password?: string
  password_confirmation?: string
  terms?: string
  form?: string
}

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

function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <div
      id={id}
      role="alert"
      className="flex items-center gap-1"
      style={{ marginTop: '4px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '12px', color: '#E94F37' }}
    >
      <AlertCircle size={12} aria-hidden="true" />
      {message}
    </div>
  )
}

export function StepAccountBasics({ onComplete, defaultValues, isLoading, serverError }: Props) {
  const [firstName, setFirstName] = useState(defaultValues?.first_name ?? '')
  const [lastName, setLastName] = useState(defaultValues?.last_name ?? '')
  const [email, setEmail] = useState(defaultValues?.email ?? '')
  const [password, setPassword] = useState(defaultValues?.password ?? '')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  // Focus states
  const [focused, setFocused] = useState<Record<string, boolean>>({})

  function touch(field: string) {
    setTouched((p) => ({ ...p, [field]: true }))
  }

  function validateAll(): FormErrors {
    const e: FormErrors = {}
    if (!firstName.trim()) e.first_name = 'First name is required.'
    if (!lastName.trim()) e.last_name = 'Last name is required.'
    if (!email.trim()) {
      e.email = 'Email address is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = 'Please enter a valid email address.'
    }
    if (!password) {
      e.password = 'Password is required.'
    } else if (password.length < 8) {
      e.password = 'Min 8 characters, at least one uppercase letter and one number.'
    }
    if (!passwordConfirmation) {
      e.password_confirmation = 'Please confirm your password.'
    } else if (password !== passwordConfirmation) {
      e.password_confirmation = 'Passwords do not match.'
    }
    if (!termsAccepted) e.terms = 'Please accept the terms to continue.'
    return e
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched({ first_name: true, last_name: true, email: true, password: true, password_confirmation: true, terms: true })
    const errs = validateAll()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    await onComplete({ first_name: firstName, last_name: lastName, email, password, password_confirmation: passwordConfirmation })
  }

  const strength = getPasswordStrength(password)

  return (
    <div className="w-full">
      {/* Heading */}
      <h1
        style={{
          fontFamily: 'var(--font-sora), Sora, sans-serif',
          fontSize: '26px',
          fontWeight: 700,
          color: '#2E2E2E',
          lineHeight: 1.2,
          marginBottom: '6px',
        }}
      >
        Create your account
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
          fontSize: '14px',
          color: '#6B7280',
          lineHeight: 1.6,
          marginBottom: '28px',
        }}
      >
        Start with the basics. You can always add more later.
      </p>

      {/* Server / form-level error */}
      {(serverError ?? errors.form) && (
        <div
          role="alert"
          className="flex items-start gap-2"
          style={{
            marginBottom: '20px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '10px 14px',
          }}
        >
          <AlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
          <span style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#991B1B' }}>
            {serverError ?? errors.form}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* First name + Last name row */}
        <div className="grid grid-cols-2" style={{ gap: '12px' }}>
          <div>
            <label htmlFor="reg-first-name" style={labelStyle}>FIRST NAME</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} aria-hidden="true" />
              <input
                id="reg-first-name"
                type="text"
                autoComplete="given-name"
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onBlur={() => { touch('first_name'); setFocused((p) => ({ ...p, first_name: false })) }}
                onFocus={() => setFocused((p) => ({ ...p, first_name: true }))}
                style={getInputStyle(Boolean(touched.first_name && errors.first_name), Boolean(focused.first_name))}
                aria-invalid={Boolean(touched.first_name && errors.first_name)}
                aria-describedby={touched.first_name && errors.first_name ? 'first-name-error' : undefined}
              />
            </div>
            {touched.first_name && errors.first_name && <FieldError id="first-name-error" message={errors.first_name} />}
          </div>

          <div>
            <label htmlFor="reg-last-name" style={labelStyle}>LAST NAME</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} aria-hidden="true" />
              <input
                id="reg-last-name"
                type="text"
                autoComplete="family-name"
                placeholder="Appleseed"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onBlur={() => { touch('last_name'); setFocused((p) => ({ ...p, last_name: false })) }}
                onFocus={() => setFocused((p) => ({ ...p, last_name: true }))}
                style={getInputStyle(Boolean(touched.last_name && errors.last_name), Boolean(focused.last_name))}
                aria-invalid={Boolean(touched.last_name && errors.last_name)}
                aria-describedby={touched.last_name && errors.last_name ? 'last-name-error' : undefined}
              />
            </div>
            {touched.last_name && errors.last_name && <FieldError id="last-name-error" message={errors.last_name} />}
          </div>
        </div>

        {/* Email */}
        <div style={{ marginTop: '20px' }}>
          <label htmlFor="reg-email" style={labelStyle}>EMAIL ADDRESS</label>
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} aria-hidden="true" />
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => { touch('email'); setFocused((p) => ({ ...p, email: false })) }}
              onFocus={() => setFocused((p) => ({ ...p, email: true }))}
              style={getInputStyle(Boolean(touched.email && errors.email), Boolean(focused.email))}
              aria-invalid={Boolean(touched.email && errors.email)}
              aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
            />
          </div>
          {touched.email && errors.email && <FieldError id="email-error" message={errors.email} />}
        </div>

        {/* Password */}
        <div style={{ marginTop: '20px' }}>
          <label htmlFor="reg-password" style={labelStyle}>PASSWORD</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} aria-hidden="true" />
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => { touch('password'); setFocused((p) => ({ ...p, password: false })) }}
              onFocus={() => setFocused((p) => ({ ...p, password: true }))}
              style={{ ...getInputStyle(Boolean(touched.password && errors.password), Boolean(focused.password)), paddingRight: '42px' }}
              aria-invalid={Boolean(touched.password && errors.password)}
              aria-describedby="password-hint"
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

          {/* Strength indicator */}
          {password.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div className="flex gap-1" aria-hidden="true">
                {[1, 2, 3, 4].map((seg) => (
                  <div
                    key={seg}
                    style={{
                      flex: 1,
                      height: '3px',
                      borderRadius: '9999px',
                      background: seg <= strength ? STRENGTH_COLORS[strength] : '#E5E7EB',
                      transition: 'background 200ms',
                    }}
                  />
                ))}
              </div>
              {strength > 0 && (
                <span style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '11px', color: STRENGTH_COLORS[strength], marginTop: '3px', display: 'block' }}>
                  {STRENGTH_LABELS[strength]}
                </span>
              )}
            </div>
          )}

          <p
            id="password-hint"
            style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '12px', color: '#9CA3AF', marginTop: '5px' }}
          >
            Min 8 characters, at least one uppercase letter and one number.
          </p>
          {touched.password && errors.password && <FieldError id="password-error" message={errors.password} />}
        </div>

        {/* Confirm password */}
        <div style={{ marginTop: '20px' }}>
          <label htmlFor="reg-confirm-password" style={labelStyle}>CONFIRM PASSWORD</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none' }} aria-hidden="true" />
            <input
              id="reg-confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              onBlur={() => { touch('password_confirmation'); setFocused((p) => ({ ...p, confirm_password: false })) }}
              onFocus={() => setFocused((p) => ({ ...p, confirm_password: true }))}
              style={getInputStyle(Boolean(touched.password_confirmation && errors.password_confirmation), Boolean(focused.confirm_password))}
              aria-invalid={Boolean(touched.password_confirmation && errors.password_confirmation)}
              aria-describedby={touched.password_confirmation && errors.password_confirmation ? 'confirm-password-error' : undefined}
            />
          </div>
          {touched.password_confirmation && errors.password_confirmation && <FieldError id="confirm-password-error" message={errors.password_confirmation} />}
        </div>

        {/* Terms checkbox */}
        <div style={{ marginTop: '20px' }}>
          <label
            className="flex items-start gap-3"
            style={{ cursor: 'pointer' }}
          >
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
              {/* TODO [ROUTE]: Add terms and privacy policy URLs */}
              <a href="#" style={{ color: '#0FA3B1', textDecoration: 'none' }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}>Terms of Service</a>
              {' '}and{' '}
              <a href="#" style={{ color: '#0FA3B1', textDecoration: 'none' }} onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')} onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}>Privacy Policy</a>
            </span>
          </label>
          {touched.terms && errors.terms && (
            <div className="flex items-center gap-1" style={{ marginTop: '4px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '12px', color: '#E94F37' }}>
              <AlertCircle size={12} aria-hidden="true" />
              {errors.terms}
            </div>
          )}
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center justify-center gap-2 w-full"
          style={{
            marginTop: '24px',
            height: '44px',
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
          {isLoading ? 'Creating account...' : 'Create Account →'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '28px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#6B7280' }}>
        Already have an account?{' '}
        <Link
          href="/login"
          style={{ color: '#0FA3B1', fontWeight: 500, textDecoration: 'none' }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          Sign in →
        </Link>
      </p>
    </div>
  )
}

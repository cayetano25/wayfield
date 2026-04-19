'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { ApiError, apiPost } from '@/lib/api/client'
import { setStoredUser, setToken, type AdminUser } from '@/lib/auth/session'
import { SocialLoginButtons } from './SocialLoginButtons'

interface LoginResponse {
  token: string
  user: AdminUser
}

interface FormErrors {
  email?: string
  password?: string
  form?: string
}

interface TouchedFields {
  email: boolean
  password: boolean
}

function validate(email: string, password: string): FormErrors {
  const errs: FormErrors = {}
  if (!email.trim()) {
    errs.email = 'Email address is required.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errs.email = 'Please enter a valid email address.'
  }
  if (!password) {
    errs.password = 'Password is required.'
  } else if (password.length < 8) {
    errs.password = 'Password must be at least 8 characters.'
  }
  return errs
}

export function LoginForm() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<TouchedFields>({ email: false, password: false })

  function handleBlur(field: keyof TouchedFields) {
    setTouched((prev) => ({ ...prev, [field]: true }))
    const errs = validate(email, password)
    setErrors((prev) => ({ ...prev, [field]: errs[field] }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setTouched({ email: true, password: true })

    const validationErrors = validate(email, password)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsLoading(true)
    setErrors({})

    try {
      // TODO [AUTH]: Connect to POST /api/v1/auth/login
      //   Request: { email, password }
      //   Response: { token, user: { id, first_name, last_name, email }, organization_memberships }
      //   On success: call setToken(token) + setStoredUser(user), redirect to /dashboard
      //   On 401: set errors.form = "Incorrect email or password."
      //   On 422: map response.errors to field-level errors
      const res = await apiPost<LoginResponse>('/auth/login', {
        email,
        password,
        platform: 'web',
      })
      setToken(res.token)
      setStoredUser(res.user)
      router.push('/dashboard')
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setErrors({ form: 'Incorrect email or password.' })
        } else if (err.status === 422 && err.errors) {
          const fieldErrors: FormErrors = {}
          if (err.errors.email) fieldErrors.email = err.errors.email[0]
          if (err.errors.password) fieldErrors.password = err.errors.password[0]
          if (!fieldErrors.email && !fieldErrors.password) {
            fieldErrors.form = err.message
          }
          setErrors(fieldErrors)
        } else {
          setErrors({ form: err.message || 'Something went wrong. Please try again.' })
        }
      } else {
        setErrors({ form: 'Something went wrong. Please try again.' })
      }
    } finally {
      setIsLoading(false)
    }
  }

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

  function getInputStyle(
    field: keyof TouchedFields,
    focused: boolean,
  ): React.CSSProperties {
    const hasError = touched[field] && errors[field]
    if (hasError) {
      return {
        ...inputBaseStyle,
        border: '1px solid #E94F37',
        boxShadow: '0 0 0 3px rgba(233,79,55,0.10)',
      }
    }
    if (focused) {
      return {
        ...inputBaseStyle,
        border: '1px solid #0FA3B1',
        boxShadow: '0 0 0 3px rgba(15,163,177,0.12)',
      }
    }
    return { ...inputBaseStyle, border: '1px solid #E5E7EB' }
  }

  const [emailFocused, setEmailFocused] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)

  return (
    <div className="w-full">
      {/* Logo */}
      <div className="flex items-center gap-3">
        {/* Abstract W mark */}
        <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <rect x="2" y="6" width="10" height="16" rx="2" fill="#0FA3B1" opacity="0.9"/>
          <rect x="10" y="10" width="10" height="12" rx="2" fill="#0FA3B1" opacity="0.6"/>
          <rect x="16" y="6" width="10" height="16" rx="2" fill="#0FA3B1" opacity="0.9"/>
        </svg>
        <span
          style={{
            fontFamily: 'var(--font-sora), Sora, sans-serif',
            fontSize: '26px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}
        >
          <span style={{ color: '#2E2E2E' }}>Way</span>
          <span style={{ color: '#0FA3B1' }}>field</span>
        </span>
      </div>

      {/* Eyebrow */}
      <p
        style={{
          fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
          fontSize: '10px',
          fontWeight: 700,
          color: '#0FA3B1',
          letterSpacing: '0.12em',
          marginTop: '28px',
        }}
      >
        WORKSHOP MANAGEMENT PLATFORM
      </p>

      {/* Heading */}
      <h1
        style={{
          fontFamily: 'var(--font-sora), Sora, sans-serif',
          fontSize: '30px',
          fontWeight: 700,
          color: '#2E2E2E',
          marginTop: '6px',
          lineHeight: 1.2,
        }}
      >
        Welcome back
      </h1>

      {/* Subheading */}
      <p
        style={{
          fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
          fontSize: '14px',
          fontWeight: 400,
          color: '#6B7280',
          lineHeight: 1.6,
          marginTop: '8px',
          maxWidth: '340px',
        }}
      >
        Sign in to your Wayfield account to manage your workshops and participant experience.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        {/* Email field */}
        <div style={{ marginTop: '32px' }}>
          <label
            htmlFor="login-email"
            style={{
              display: 'block',
              fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
              fontSize: '11px',
              fontWeight: 600,
              color: '#374151',
              letterSpacing: '0.06em',
              marginBottom: '6px',
            }}
          >
            EMAIL ADDRESS
          </label>
          <div style={{ position: 'relative' }}>
            <Mail
              size={16}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9CA3AF',
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="alex@workshop.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => {
                setEmailFocused(false)
                handleBlur('email')
              }}
              onFocus={() => setEmailFocused(true)}
              style={getInputStyle('email', emailFocused)}
              aria-invalid={touched.email && !!errors.email}
              aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
            />
          </div>
          {touched.email && errors.email && (
            <div
              id="email-error"
              role="alert"
              className="flex items-center gap-1"
              style={{
                marginTop: '4px',
                fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                fontSize: '12px',
                color: '#E94F37',
              }}
            >
              <AlertCircle size={12} aria-hidden="true" />
              {errors.email}
            </div>
          )}
        </div>

        {/* Password field */}
        <div style={{ marginTop: '20px' }}>
          <label
            htmlFor="login-password"
            style={{
              display: 'block',
              fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
              fontSize: '11px',
              fontWeight: 600,
              color: '#374151',
              letterSpacing: '0.06em',
              marginBottom: '6px',
            }}
          >
            PASSWORD
          </label>
          <div style={{ position: 'relative' }}>
            <Lock
              size={16}
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9CA3AF',
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => {
                setPasswordFocused(false)
                handleBlur('password')
              }}
              onFocus={() => setPasswordFocused(true)}
              style={{
                ...getInputStyle('password', passwordFocused),
                paddingLeft: '42px',
                paddingRight: '42px',
              }}
              aria-invalid={touched.password && !!errors.password}
              aria-describedby={touched.password && errors.password ? 'password-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#6B7280',
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {touched.password && errors.password && (
            <div
              id="password-error"
              role="alert"
              className="flex items-center gap-1"
              style={{
                marginTop: '4px',
                fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                fontSize: '12px',
                color: '#E94F37',
              }}
            >
              <AlertCircle size={12} aria-hidden="true" />
              {errors.password}
            </div>
          )}
        </div>

        {/* Remember me / Forgot password */}
        <div
          className="flex items-center justify-between"
          style={{ marginTop: '16px' }}
        >
          <label
            className="flex items-center gap-2"
            style={{ cursor: 'pointer' }}
          >
            <div
              onClick={() => setRememberMe((v) => !v)}
              role="checkbox"
              aria-checked={rememberMe}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  setRememberMe((v) => !v)
                }
              }}
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                border: rememberMe ? 'none' : '1.5px solid #D1D5DB',
                background: rememberMe ? '#0FA3B1' : 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'background 150ms, border-color 150ms',
              }}
            >
              {rememberMe && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span
              style={{
                fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                fontSize: '13px',
                color: '#4B5563',
                userSelect: 'none',
              }}
            >
              Remember me
            </span>
          </label>

          {/* TODO [ROUTE]: Forgot password link → /auth/forgot-password */}
          <Link
            href="/forgot-password"
            style={{
              fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
              fontSize: '13px',
              color: '#0FA3B1',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#0891B2')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#0FA3B1')}
          >
            Forgot password?
          </Link>
        </div>

        {/* Form-level error */}
        {errors.form && (
          <div
            role="alert"
            className="flex items-start gap-2"
            style={{
              marginTop: '16px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              padding: '10px 14px',
            }}
          >
            <AlertCircle
              size={16}
              style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px' }}
              aria-hidden="true"
            />
            <span
              style={{
                fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                fontSize: '13px',
                color: '#991B1B',
              }}
            >
              {errors.form}
            </span>
          </div>
        )}

        {/* Sign in button */}
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
          onMouseEnter={(e) => {
            if (!isLoading) e.currentTarget.style.background = '#0891B2'
          }}
          onMouseLeave={(e) => {
            if (!isLoading) e.currentTarget.style.background = '#0FA3B1'
          }}
          onMouseDown={(e) => {
            if (!isLoading) e.currentTarget.style.background = '#0E7490'
          }}
          onMouseUp={(e) => {
            if (!isLoading) e.currentTarget.style.background = '#0891B2'
          }}
        >
          {isLoading && (
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                animation: 'spin 0.7s linear infinite',
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
          )}
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      {/* Divider */}
      <div
        className="flex items-center"
        style={{ marginTop: '24px', gap: '0' }}
      >
        <hr style={{ flex: 1, borderTop: '1px solid #E5E7EB', borderBottom: 'none' }} />
        <span
          style={{
            fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
            fontSize: '11px',
            fontWeight: 600,
            color: '#9CA3AF',
            letterSpacing: '0.08em',
            padding: '0 12px',
          }}
        >
          OR CONTINUE WITH
        </span>
        <hr style={{ flex: 1, borderTop: '1px solid #E5E7EB', borderBottom: 'none' }} />
      </div>

      {/* Social buttons */}
      <div style={{ marginTop: '16px' }}>
        <SocialLoginButtons disabled={isLoading} />
      </div>

      {/* Create account */}
      <p
        style={{
          textAlign: 'center',
          marginTop: '32px',
          fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
          fontSize: '13px',
          color: '#6B7280',
        }}
      >
        New to Wayfield?{' '}
        {/* TODO [ROUTE]: Create account link → /auth/register */}
        <Link
          href="/register"
          style={{ color: '#0FA3B1', fontWeight: 500, textDecoration: 'none' }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          Create your account →
        </Link>
      </p>
    </div>
  )
}

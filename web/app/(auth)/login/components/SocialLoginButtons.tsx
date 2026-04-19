'use client'

interface SocialLoginButtonsProps {
  onGoogleClick?: () => void
  onFacebookClick?: () => void
  disabled?: boolean
}

// TODO [AUTH]: Google OAuth → connect to GET /api/v1/auth/google/redirect
//   This initiates the Google OAuth flow. Per IDENTITY_AND_AUTH.md,
//   social login is additive — it links to an existing User record.
//   Phase 3 feature — not active in MVP.

// TODO [AUTH]: Facebook OAuth → connect to GET /api/v1/auth/facebook/redirect
//   Same pattern as Google. Phase 3 feature.

export function SocialLoginButtons({
  onGoogleClick,
  onFacebookClick,
  disabled = false,
}: SocialLoginButtonsProps) {
  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    flex: 1,
    height: '44px',
    padding: '10px 16px',
    background: 'white',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'background 150ms ease, border-color 150ms ease',
    whiteSpace: 'nowrap' as const,
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onGoogleClick}
          disabled={disabled}
          style={buttonStyle}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = '#F9FAFB'
              e.currentTarget.style.borderColor = '#D1D5DB'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white'
            e.currentTarget.style.borderColor = '#E5E7EB'
          }}
          aria-label="Continue with Google"
        >
          {/* Google G multi-color logo */}
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.082 17.64 11.774 17.64 9.2Z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"/>
          </svg>
          Continue with Google
        </button>

        <button
          type="button"
          onClick={onFacebookClick}
          disabled={disabled}
          style={buttonStyle}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = '#F9FAFB'
              e.currentTarget.style.borderColor = '#D1D5DB'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white'
            e.currentTarget.style.borderColor = '#E5E7EB'
          }}
          aria-label="Continue with Facebook"
        >
          {/* Facebook f in blue circle */}
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="9" cy="9" r="9" fill="#1877F2"/>
            <path fill="white" d="M10.22 9.75h1.56l.25-1.62H10.22V7.2c0-.44.22-.87.92-.87h.71V4.96s-.64-.11-1.26-.11c-1.29 0-2.13.78-2.13 2.2v1.08H6.98v1.62h1.48V14h1.76V9.75Z"/>
          </svg>
          Continue with Facebook
        </button>
      </div>

      <p
        style={{
          textAlign: 'center',
          fontSize: '10px',
          color: '#9CA3AF',
          fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
          marginTop: '2px',
        }}
      >
        Social sign-in coming soon. Use email to sign in now.
      </p>
    </div>
  )
}

'use client'

import { useState, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { ApiError } from '@/lib/api/client'
import { completeOnboarding } from '@/lib/api/auth'
import { useRouter } from 'next/navigation'

interface Props {
  onBack: () => void
}

export function StepJoinWorkshop({ onBack }: Props) {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!joinCode.trim()) {
      setError('Please enter a workshop join code.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await completeOnboarding({ intent: 'join_workshop', join_code: joinCode.trim().toUpperCase() })
      router.push(res.redirect ?? '/dashboard')
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('Workshop not found. Check the code and try again.')
      } else if (err instanceof ApiError) {
        setError(err.message || 'Something went wrong. Please try again.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    color: '#374151',
    letterSpacing: '0.06em',
    marginBottom: '8px',
  }

  return (
    <div className="w-full">
      <h1 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '26px', fontWeight: 700, color: '#2E2E2E', lineHeight: 1.2, marginBottom: '6px' }}>
        Enter your workshop code
      </h1>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '28px' }}>
        Your organizer will have shared this code with you.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="join-code" style={labelStyle}>WORKSHOP JOIN CODE</label>
          <input
            id="join-code"
            type="text"
            placeholder="e.g. MEADOW2025"
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(null) }}
            style={{
              width: '100%',
              height: '56px',
              padding: '0 20px',
              borderRadius: '8px',
              fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
              fontSize: '20px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#2E2E2E',
              background: 'white',
              border: error ? '1px solid #E94F37' : '1px solid #E5E7EB',
              boxShadow: error ? '0 0 0 3px rgba(233,79,55,0.10)' : 'none',
              outline: 'none',
              transition: 'border-color 150ms, box-shadow 150ms',
            }}
            onFocus={(e) => { if (!error) { e.currentTarget.style.borderColor = '#0FA3B1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(15,163,177,0.12)' } }}
            onBlur={(e) => { if (!error) { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' } }}
            autoComplete="off"
            spellCheck={false}
          />
          {error && (
            <div className="flex items-center gap-1" style={{ marginTop: '6px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#E94F37' }}>
              <AlertCircle size={13} aria-hidden="true" />
              {error}
            </div>
          )}
        </div>

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
        >
          {isLoading && (
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} aria-hidden="true" />
          )}
          {isLoading ? 'Joining...' : 'Join Workshop →'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <button
          type="button"
          onClick={onBack}
          style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#6B7280')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#9CA3AF')}
        >
          ← Go back and choose a different option
        </button>
      </div>
    </div>
  )
}

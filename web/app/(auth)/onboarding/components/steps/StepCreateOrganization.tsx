'use client'

import { useState, useEffect, useRef, type FormEvent } from 'react'
import { AlertCircle } from 'lucide-react'
import { ApiError } from '@/lib/api/client'
import { completeOnboarding } from '@/lib/api/auth'
import { generateSlug } from '@/lib/utils/slug'

interface Props {
  onBack: () => void
  onOrgCreated: (orgId: number) => void
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

const inputBaseStyle: React.CSSProperties = {
  width: '100%',
  height: '44px',
  padding: '11px 16px',
  borderRadius: '8px',
  fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
  fontSize: '14px',
  color: '#2E2E2E',
  background: 'white',
  border: '1px solid #E5E7EB',
  outline: 'none',
  transition: 'border-color 150ms, box-shadow 150ms',
}

export function StepCreateOrganization({ onBack, onOrgCreated }: Props) {
  const [orgName, setOrgName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [slugError, setSlugError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameFocused, setNameFocused] = useState(false)
  const [slugFocused, setSlugFocused] = useState(false)

  // Debounced slug uniqueness check
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!slugEdited) {
      setSlug(generateSlug(orgName))
    }
  }, [orgName, slugEdited])

  useEffect(() => {
    if (!slug) { setSlugError(null); return }
    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current)
    slugCheckTimer.current = setTimeout(() => {
      // TODO [API]: Check slug uniqueness via GET /api/v1/organizations/check-slug?slug={slug}
      // For now, no-op
    }, 400)
    return () => { if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current) }
  }, [slug])

  function getInputStyle(hasError: boolean, focused: boolean): React.CSSProperties {
    if (hasError) return { ...inputBaseStyle, border: '1px solid #E94F37', boxShadow: '0 0 0 3px rgba(233,79,55,0.10)' }
    if (focused) return { ...inputBaseStyle, border: '1px solid #0FA3B1', boxShadow: '0 0 0 3px rgba(15,163,177,0.12)' }
    return inputBaseStyle
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!orgName.trim()) { setError('Organization name is required.'); return }
    if (!slug.trim()) { setSlugError('URL slug is required.'); return }
    if (slugError) return

    setIsLoading(true)
    setError(null)
    try {
      const res = await completeOnboarding({ intent: 'create_organization', organization_name: orgName.trim(), organization_slug: slug.trim() })
      if (res.organization_id) {
        onOrgCreated(res.organization_id)
      } else {
        // Fallback if backend doesn't return org_id yet
        onOrgCreated(0)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.errors) {
        if (err.errors.organization_slug) {
          setSlugError('This URL is already taken. Try another.')
        } else {
          setError(err.message || 'Something went wrong. Please try again.')
        }
      } else if (err instanceof ApiError) {
        setError(err.message || 'Something went wrong. Please try again.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      <h1 style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '26px', fontWeight: 700, color: '#2E2E2E', lineHeight: 1.2, marginBottom: '6px' }}>
        Set up your organization
      </h1>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '28px' }}>
        This is your workspace for creating and managing workshops.
      </p>

      {error && (
        <div role="alert" className="flex items-start gap-2" style={{ marginBottom: '20px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px' }}>
          <AlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
          <span style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#991B1B' }}>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Organization name */}
        <div>
          <label htmlFor="org-name" style={labelStyle}>ORGANIZATION NAME</label>
          <input
            id="org-name"
            type="text"
            placeholder="e.g. Cascade Photography"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value.slice(0, 255))}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            style={getInputStyle(false, nameFocused)}
          />
        </div>

        {/* URL slug */}
        <div style={{ marginTop: '20px' }}>
          <label htmlFor="org-slug" style={labelStyle}>WAYFIELD URL</label>
          <div style={{ display: 'flex', alignItems: 'center', height: '44px', borderRadius: '8px', border: slugError ? '1px solid #E94F37' : slugFocused ? '1px solid #0FA3B1' : '1px solid #E5E7EB', boxShadow: slugError ? '0 0 0 3px rgba(233,79,55,0.10)' : slugFocused ? '0 0 0 3px rgba(15,163,177,0.12)' : 'none', overflow: 'hidden', transition: 'border-color 150ms, box-shadow 150ms' }}>
            <span style={{ padding: '0 12px 0 16px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#9CA3AF', background: '#F9FAFB', borderRight: '1px solid #E5E7EB', height: '100%', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', flexShrink: 0 }}>
              wayfield.app/
            </span>
            <input
              id="org-slug"
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60))
                setSlugEdited(true)
                setSlugError(null)
              }}
              onFocus={() => setSlugFocused(true)}
              onBlur={() => setSlugFocused(false)}
              style={{ flex: 1, height: '100%', padding: '0 16px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#2E2E2E', background: 'white', border: 'none', outline: 'none' }}
              placeholder="your-organization"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          {slugError ? (
            <div className="flex items-center gap-1" style={{ marginTop: '4px', fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '12px', color: '#E94F37' }}>
              <AlertCircle size={12} aria-hidden="true" />
              {slugError}
            </div>
          ) : (
            <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
              This will be your organization&apos;s public URL.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center justify-center gap-2 w-full"
          style={{
            marginTop: '28px',
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
          {isLoading ? 'Setting up...' : 'Create Organization →'}
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

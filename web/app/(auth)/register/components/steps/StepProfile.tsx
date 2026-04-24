'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, AlertCircle } from 'lucide-react'
import { AddressForm } from '@/components/ui/AddressForm'
import { PRONOUN_OPTIONS, type StepTwoData } from '@/lib/types/onboarding'
import type { AddressFormData } from '@/lib/types/address'

interface Props {
  onComplete: (data: StepTwoData) => Promise<void>
  onBack: () => void
  onSkip: () => void
  defaultValues?: Partial<StepTwoData>
  isLoading: boolean
  serverError: string | null
}

// Common timezones list
const COMMON_TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'America/Honolulu', 'America/Phoenix', 'America/Toronto',
  'America/Vancouver', 'America/Mexico_City', 'America/Sao_Paulo', 'America/Buenos_Aires',
  'America/Bogota', 'America/Lima', 'America/Santiago', 'America/Caracas',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome',
  'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Vienna', 'Europe/Zurich',
  'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen', 'Europe/Helsinki',
  'Europe/Warsaw', 'Europe/Prague', 'Europe/Budapest', 'Europe/Bucharest',
  'Europe/Athens', 'Europe/Istanbul', 'Europe/Kiev', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Jakarta',
  'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Asia/Taipei', 'Asia/Manila', 'Asia/Kuala_Lumpur', 'Asia/Colombo', 'Asia/Karachi',
  'Asia/Tashkent', 'Asia/Almaty', 'Asia/Novosibirsk', 'Asia/Irkutsk', 'Asia/Yakutsk',
  'Asia/Vladivostok', 'Pacific/Auckland', 'Pacific/Fiji', 'Pacific/Guam',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth',
  'Australia/Adelaide', 'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Nairobi',
  'Africa/Lagos', 'Africa/Casablanca', 'Atlantic/Reykjavik',
]

const inputBaseStyle: React.CSSProperties = {
  width: '100%',
  height: '44px',
  padding: '11px 16px',
  borderRadius: '8px',
  fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
  fontSize: '14px',
  color: '#2E2E2E',
  outline: 'none',
  transition: 'border-color 150ms, box-shadow 150ms',
  background: 'white',
  border: '1px solid #E5E7EB',
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

const helperStyle: React.CSSProperties = {
  fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
  fontSize: '12px',
  color: '#9CA3AF',
  marginTop: '4px',
}

export function StepProfile({ onComplete, onBack, onSkip, defaultValues, isLoading, serverError }: Props) {
  const [pronouns, setPronouns] = useState(defaultValues?.pronouns ?? '')
  const [customPronouns, setCustomPronouns] = useState('')
  const [phoneNumber, setPhoneNumber] = useState(defaultValues?.phone_number ?? '')
  const [addressOpen, setAddressOpen] = useState(defaultValues?.address != null)
  const [address, setAddress] = useState<AddressFormData | null>(defaultValues?.address ?? null)
  const [timezone, setTimezone] = useState(defaultValues?.timezone ?? '')
  const [timezoneFocused, setTimezoneFocused] = useState(false)
  const [phoneFocused, setPhoneFocused] = useState(false)

  // Timezone combobox
  const [tzComboOpen, setTzComboOpen] = useState(false)
  const [tzQuery, setTzQuery] = useState('')
  const tzRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!timezone) {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (detected) setTimezone(detected)
      } catch {
        // ignore
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (tzRef.current && !tzRef.current.contains(e.target as Node)) {
        setTzComboOpen(false)
        setTzQuery('')
      }
    }
    if (tzComboOpen) document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [tzComboOpen])

  const filteredTimezones = tzQuery
    ? COMMON_TIMEZONES.filter((tz) => tz.toLowerCase().includes(tzQuery.toLowerCase()))
    : COMMON_TIMEZONES

  const effectivePronouns = pronouns === 'Other' ? customPronouns : pronouns

  async function handleSave() {
    await onComplete({
      pronouns: effectivePronouns,
      phone_number: phoneNumber,
      timezone,
      address: addressOpen ? address : null,
    })
  }

  return (
    <div className="w-full">
      <h1
        style={{ fontFamily: 'var(--font-sora), Sora, sans-serif', fontSize: '26px', fontWeight: 700, color: '#2E2E2E', lineHeight: 1.2, marginBottom: '6px' }}
      >
        Tell us a bit about yourself
      </h1>
      <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', color: '#6B7280', lineHeight: 1.6, marginBottom: '28px' }}>
        This information is optional — you can always update it in your settings.
      </p>

      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-2"
          style={{ marginBottom: '20px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px' }}
        >
          <AlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
          <span style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#991B1B' }}>
            {serverError}
          </span>
        </div>
      )}

      {/* Pronouns */}
      <div>
        <label style={labelStyle}>PRONOUNS</label>
        <p style={helperStyle}>Optional. Helps others address you correctly.</p>
        <div className="flex flex-wrap" style={{ gap: '8px', marginTop: '10px' }}>
          {PRONOUN_OPTIONS.map((opt) => {
            const isSelected = pronouns === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setPronouns(opt.value)
                  if (opt.value !== 'Other') setCustomPronouns('')
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                  fontSize: '12px',
                  fontWeight: isSelected ? 600 : 500,
                  color: isSelected ? '#0FA3B1' : '#6B7280',
                  background: isSelected ? '#F0FDFF' : 'white',
                  border: isSelected ? '1px solid #0FA3B1' : '1px solid #E5E7EB',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'white' }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        {pronouns === 'Other' && (
          <input
            type="text"
            placeholder="Type your pronouns..."
            value={customPronouns}
            onChange={(e) => setCustomPronouns(e.target.value.slice(0, 50))}
            style={{ ...inputBaseStyle, marginTop: '10px' }}
            autoFocus
          />
        )}
      </div>

      {/* Phone number */}
      <div style={{ marginTop: '24px' }}>
        <label htmlFor="profile-phone" style={labelStyle}>PHONE NUMBER</label>
        <p style={helperStyle}>Optional. Used for workshop communications if needed.</p>
        <input
          id="profile-phone"
          type="tel"
          autoComplete="tel"
          placeholder="+1 (555) 000-0000"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          onFocus={() => setPhoneFocused(true)}
          onBlur={() => setPhoneFocused(false)}
          style={{ ...inputBaseStyle, marginTop: '10px', ...(phoneFocused ? { border: '1px solid #0FA3B1', boxShadow: '0 0 0 3px rgba(15,163,177,0.12)' } : {}) }}
        />
      </div>

      {/* Timezone */}
      <div style={{ marginTop: '24px' }}>
        <label style={labelStyle}>TIMEZONE</label>
        <p style={helperStyle}>We&apos;ve detected your timezone. You can change it if needed.</p>
        <div ref={tzRef} style={{ position: 'relative', marginTop: '10px' }}>
          <input
            type="text"
            value={tzComboOpen ? tzQuery : (timezone || '')}
            placeholder="Select timezone..."
            onChange={(e) => { setTzQuery(e.target.value); if (!tzComboOpen) setTzComboOpen(true) }}
            onFocus={() => { setTzComboOpen(true); setTzQuery(''); setTimezoneFocused(true) }}
            onBlur={() => setTimezoneFocused(false)}
            style={{
              ...inputBaseStyle,
              paddingRight: '40px',
              ...(timezoneFocused ? { border: '1px solid #0FA3B1', boxShadow: '0 0 0 3px rgba(15,163,177,0.12)' } : {}),
            }}
            autoComplete="off"
          />
          <ChevronDown
            size={16}
            style={{
              position: 'absolute', right: '14px', top: '50%', transform: `translateY(-50%) ${tzComboOpen ? 'rotate(180deg)' : 'rotate(0deg)'}`,
              color: '#9CA3AF', pointerEvents: 'none', transition: 'transform 200ms',
            }}
            aria-hidden="true"
          />
          {tzComboOpen && filteredTimezones.length > 0 && (
            <div style={{
              position: 'absolute', zIndex: 50, left: 0, right: 0, top: '100%', marginTop: '4px',
              background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.10)', maxHeight: '200px', overflowY: 'auto',
            }}>
              {filteredTimezones.slice(0, 60).map((tz) => (
                <button
                  key={tz}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setTimezone(tz)
                    setTzComboOpen(false)
                    setTzQuery('')
                  }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '9px 14px',
                    fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                    fontSize: '13px', background: tz === timezone ? '#F0FDFF' : 'white',
                    color: tz === timezone ? '#0FA3B1' : '#2E2E2E',
                    fontWeight: tz === timezone ? 600 : 400,
                    border: 'none', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { if (tz !== timezone) e.currentTarget.style.background = '#F9FAFB' }}
                  onMouseLeave={(e) => { if (tz !== timezone) e.currentTarget.style.background = 'white' }}
                >
                  {tz}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Address */}
      <div style={{ marginTop: '24px' }}>
        <button
          type="button"
          onClick={() => setAddressOpen((v) => !v)}
          className="flex items-center justify-between w-full"
          style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
        >
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
              Add your address
            </span>
            <span style={{
              fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
              fontSize: '10px', fontWeight: 500, color: '#9CA3AF',
              background: '#F3F4F6', padding: '2px 8px', borderRadius: '9999px',
            }}>
              Optional
            </span>
          </div>
          <ChevronDown
            size={16}
            style={{
              color: '#9CA3AF',
              transform: addressOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms',
            }}
            aria-hidden="true"
          />
        </button>

        {addressOpen && (
          <div style={{ marginTop: '16px' }}>
            <AddressForm
              value={address}
              onChange={setAddress}
              required={false}
              privacyNote="Your address is private and used only for certificates and correspondence. It is never shown publicly."
            />
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-3" style={{ marginTop: '32px' }}>
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          style={{
            flex: 1,
            height: '44px',
            borderRadius: '8px',
            background: 'white',
            color: '#374151',
            fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
            fontSize: '14px',
            fontWeight: 500,
            border: '1px solid #E5E7EB',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'background 150ms, border-color 150ms',
          }}
          onMouseEnter={(e) => { if (!isLoading) { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB' } }}
          onMouseLeave={(e) => { if (!isLoading) { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#E5E7EB' } }}
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading}
          className="flex items-center justify-center gap-2"
          style={{
            flex: 2,
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
          {isLoading ? 'Saving...' : 'Save & Continue →'}
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '16px' }}>
        <button
          type="button"
          onClick={onSkip}
          style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#0FA3B1', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          Skip for now →
        </button>
      </div>
    </div>
  )
}

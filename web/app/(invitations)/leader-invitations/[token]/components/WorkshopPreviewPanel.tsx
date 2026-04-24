import { Calendar, MapPin, Users } from 'lucide-react'
import type { LeaderInvitationData } from '@/lib/types/invitations'

interface Props {
  workshop: LeaderInvitationData['workshop']
  sessions: LeaderInvitationData['sessions_assigned']
  organizationName: string
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const startMonth = start.toLocaleString('en-US', { month: 'long' })
  const startDay = start.getDate()
  const endDay = end.getDate()
  const year = start.getFullYear()

  if (start.getMonth() === end.getMonth()) {
    return `${startMonth} ${startDay}–${endDay}, ${year}`
  }

  const endMonth = end.toLocaleString('en-US', { month: 'long' })
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`
}

function formatSessionTime(startAt: string, endAt: string): string {
  const start = new Date(startAt)
  const end = new Date(endAt)
  const datePart = start.toLocaleString('en-US', { month: 'short', day: 'numeric' })
  const startTime = start.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const endTime = end.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${datePart} · ${startTime} – ${endTime}`
}

const cardStyle: React.CSSProperties = {
  background: 'white',
  borderRadius: '12px',
  padding: '24px',
  width: '100%',
  border: '1px solid #F3F4F6',
}

export function WorkshopPreviewPanel({ workshop, sessions, organizationName }: Props) {
  if (!workshop) {
    return (
      <div style={cardStyle}>
        <div className="flex items-center gap-3">
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#F0FDFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Users size={18} style={{ color: '#0FA3B1' }} />
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', fontSize: '13px', color: '#6B7280' }}>
              <strong style={{ color: '#2E2E2E' }}>{organizationName}</strong> — You&apos;ll be able to view workshops
              and sessions once you join.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const location = workshop.location
  const locationDisplay =
    location?.city && location?.state_or_region
      ? `${location.city}, ${location.state_or_region}`
      : location?.city ?? location?.state_or_region ?? null

  return (
    <div style={cardStyle}>
      {/* Eyebrow */}
      <p
        style={{
          fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
          fontSize: '10px',
          fontWeight: 700,
          color: '#9CA3AF',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: '10px',
        }}
      >
        Your Upcoming Workshop
      </p>

      {/* Workshop title */}
      <h3
        style={{
          fontFamily: 'var(--font-sora), Sora, sans-serif',
          fontSize: '20px',
          fontWeight: 700,
          color: '#2E2E2E',
          lineHeight: 1.3,
          margin: 0,
        }}
      >
        {workshop.title}
      </h3>

      {/* Organization */}
      <p
        style={{
          fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
          fontSize: '13px',
          color: '#6B7280',
          marginTop: '4px',
        }}
      >
        Organized by {organizationName}
      </p>

      {/* Details row */}
      <div className="flex flex-wrap" style={{ gap: '20px', marginTop: '14px' }}>
        <div className="flex items-center gap-1.5">
          <Calendar size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
          <span
            style={{
              fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
              fontSize: '13px',
              color: '#4B5563',
            }}
          >
            {formatDateRange(workshop.start_date, workshop.end_date)}
          </span>
        </div>

        {locationDisplay && (
          <div className="flex items-center gap-1.5">
            <MapPin size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
            <span
              style={{
                fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                fontSize: '13px',
                color: '#4B5563',
              }}
            >
              {locationDisplay}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Users size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
          <span
            style={{
              fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
              fontSize: '13px',
              color: '#4B5563',
            }}
          >
            {workshop.leaders_count} {workshop.leaders_count === 1 ? 'leader' : 'leaders'} · {workshop.sessions_count}{' '}
            {workshop.sessions_count === 1 ? 'session' : 'sessions'}
          </span>
        </div>
      </div>

      {/* Assigned sessions */}
      {sessions.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <p
            style={{
              fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
              fontSize: '11px',
              fontWeight: 600,
              color: '#9CA3AF',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}
          >
            Your Assigned Sessions
          </p>

          {sessions.map((session) => (
            <div
              key={session.session_id}
              style={{
                padding: '10px 0',
                borderTop: '1px solid #F3F4F6',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#2E2E2E',
                  margin: 0,
                }}
              >
                {session.title}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                  fontSize: '12px',
                  color: '#9CA3AF',
                  margin: '2px 0 0 0',
                }}
              >
                {formatSessionTime(session.start_at, session.end_at)}
                {session.location_display ? ` · ${session.location_display}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

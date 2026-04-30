'use client';

import { useState } from 'react';
import Image from 'next/image';
import { RichTextDisplay } from '@/components/ui/RichTextDisplay';
import type { ParticipantSession, ParticipantSessionLeader } from '@/lib/types/participant';
import type { SessionLocationResponse } from '@/lib/types/session-location';

/* --- Helpers ----------------------------------------------------------- */

function formatSessionTime(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const now = new Date();
  const isToday = start.toDateString() === now.toDateString();
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  const startTime = start.toLocaleTimeString('en-US', timeOpts);
  const endTime = end.toLocaleTimeString('en-US', timeOpts);
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  const dateStr = isToday ? 'Today' : start.toLocaleDateString('en-US', dateOpts);
  return `${dateStr} · ${startTime} – ${endTime}`;
}

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

/* --- Status dot ------------------------------------------------------- */

function StatusDot({ session }: { session: ParticipantSession }) {
  if (session.attendance_status === 'checked_in') {
    return (
      <div
        className="shrink-0"
        style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#10B981' }}
      />
    );
  }
  if (session.is_next) {
    return (
      <div
        className="shrink-0"
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: '#0FA3B1',
          animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
        }}
      />
    );
  }
  return (
    <div
      className="shrink-0"
      style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        border: '1.5px solid #D1D5DB',
        backgroundColor: 'white',
      }}
    />
  );
}

/* --- Status badge ------------------------------------------------------ */

function StatusBadge({ session }: { session: ParticipantSession }) {
  if (session.attendance_status === 'checked_in') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full font-sans font-semibold shrink-0"
        style={{ fontSize: 10, backgroundColor: '#D1FAE5', color: '#065F46' }}
      >
        DONE
      </span>
    );
  }
  if (session.is_next) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full font-sans font-semibold shrink-0"
        style={{ fontSize: 10, backgroundColor: '#0FA3B1', color: 'white' }}
      >
        NEXT
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full font-sans font-semibold shrink-0"
      style={{ fontSize: 10, backgroundColor: '#F3F4F6', color: '#6B7280' }}
    >
      UPCOMING
    </span>
  );
}

/* --- Section label ----------------------------------------------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-sans font-semibold uppercase"
      style={{ fontSize: 10, letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 4 }}
    >
      {children}
    </p>
  );
}

/* --- Location block ---------------------------------------------------- */

function LocationBlock({ location }: { location: SessionLocationResponse | null }) {
  if (!location || !location.type) {
    return (
      <div>
        <SectionLabel>Location</SectionLabel>
        <p className="font-sans" style={{ fontSize: 13, color: '#9CA3AF' }}>Location TBD</p>
      </div>
    );
  }

  const { type, name, notes, address, maps_url, latitude, longitude } = location;

  // Build the address text from the canonical address, or coords as fallback.
  let addressLines: string[] = [];
  if (address?.formatted_address) {
    addressLines = [address.formatted_address];
  } else if (address) {
    if (address.address_line_1) addressLines.push(address.address_line_1);
    const cityState = [address.locality, address.administrative_area].filter(Boolean).join(', ');
    const withZip = [cityState, address.postal_code].filter(Boolean).join(' ');
    if (withZip) addressLines.push(withZip);
  } else if (type === 'coordinates' && latitude != null && longitude != null) {
    addressLines = [`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`];
  }

  return (
    <div>
      <SectionLabel>Location</SectionLabel>

      {type === 'hotel' && (
        <p className="font-sans italic" style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 2 }}>
          Workshop hotel
        </p>
      )}

      {name && (
        <p className="font-sans font-semibold" style={{ fontSize: 13, color: '#2E2E2E' }}>
          {name}
        </p>
      )}

      {addressLines.length > 0 && (
        <div className="font-sans" style={{ fontSize: 13, color: '#6B7280' }}>
          {addressLines.map((line, i) => <p key={i}>{line}</p>)}
        </div>
      )}

      {notes && (
        <p className="font-sans" style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
          📌 {notes}
        </p>
      )}

      {maps_url && (
        <div className="flex items-center" style={{ minHeight: 44 }}>
          <a
            href={maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-sans font-medium hover:underline"
            style={{ fontSize: 13, color: '#0FA3B1' }}
          >
            Open in Maps ↗
          </a>
        </div>
      )}
    </div>
  );
}

/* --- Leader avatar ----------------------------------------------------- */

function LeaderAvatar({ leader }: { leader: ParticipantSessionLeader }) {
  if (leader.profile_image_url) {
    return (
      <Image
        src={leader.profile_image_url}
        alt={`${leader.first_name} ${leader.last_name}`}
        width={36}
        height={36}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  const initials = `${leader.first_name[0] ?? ''}${leader.last_name[0] ?? ''}`.toUpperCase();
  return (
    <div
      className="flex items-center justify-center font-sans font-semibold shrink-0"
      style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#0FA3B1', color: 'white', fontSize: 13 }}
    >
      {initials}
    </div>
  );
}

/* --- Leaders block ----------------------------------------------------- */

function LeadersBlock({ leaders }: { leaders: ParticipantSessionLeader[] }) {
  if (!leaders || leaders.length === 0) return null;

  return (
    <div>
      <SectionLabel>{leaders.length === 1 ? 'Session Leader' : 'Session Leaders'}</SectionLabel>
      <div className="flex flex-col gap-3">
        {leaders.map((leader) => {
          const locationLine = [leader.city, leader.state_or_region].filter(Boolean).join(', ');
          return (
            <div key={leader.id} className="flex items-start gap-3">
              <LeaderAvatar leader={leader} />
              <div className="min-w-0">
                <p className="font-sans font-medium" style={{ fontSize: 13, color: '#2E2E2E' }}>
                  {leader.first_name} {leader.last_name}
                </p>
                {locationLine && (
                  <p className="font-sans" style={{ fontSize: 12, color: '#9CA3AF' }}>{locationLine}</p>
                )}
                {leader.bio && (
                  <p
                    className="font-sans line-clamp-2"
                    style={{ fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 1.5 }}
                  >
                    {leader.bio}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --- SessionTimeline --------------------------------------------------- */

interface SessionTimelineProps {
  sessions: ParticipantSession[];
}

export function SessionTimeline({ sessions }: SessionTimelineProps) {
  const [openId, setOpenId] = useState<number | null>(null);

  if (sessions.length === 0) return null;

  const showPhase = sessions.length > 1;
  const nextIdx = sessions.findIndex((s) => s.is_next);
  const phaseNum = nextIdx >= 0 ? nextIdx + 1 : sessions.filter((s) => s.attendance_status === 'checked_in').length;
  const totalPhases = sessions.length;

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading font-bold" style={{ fontSize: 18, color: '#2E2E2E' }}>
          Your Schedule
        </h2>
        {showPhase && phaseNum > 0 && (
          <span
            className="font-sans font-semibold uppercase"
            style={{ fontSize: 11, letterSpacing: '0.06em', color: '#9CA3AF' }}
          >
            PHASE {phaseNum} / {totalPhases}
          </span>
        )}
      </div>

      {/* Session list */}
      <div
        className="bg-white overflow-hidden"
        style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        {sessions.map((session, i) => {
          const isOpen = openId === session.id;

          return (
            <div
              key={session.id}
              style={{ borderBottom: i < sessions.length - 1 ? '1px solid #F3F4F6' : undefined }}
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : session.id)}
                className="w-full text-left flex items-center gap-4 transition-colors duration-150 hover:bg-teal-50"
                style={{
                  padding: '14px 20px',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                }}
              >
                {/* Status dot */}
                <StatusDot session={session} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-sans font-medium truncate"
                    style={{ fontSize: 14, color: '#2E2E2E' }}
                  >
                    {session.title}
                  </p>
                  <p
                    className="font-sans mt-0.5 truncate"
                    style={{ fontSize: 12, color: '#9CA3AF' }}
                  >
                    {formatSessionTime(session.start_at, session.end_at)}
                    {session.location_display
                      ? ` · ${truncate(session.location_display, 20)}`
                      : ''}
                  </p>
                </div>

                {/* Badge + chevron */}
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge session={session} />
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    style={{
                      color: '#9CA3AF',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    <path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>

              {/* Expanded detail panel */}
              {isOpen && (
                <div
                  className="flex flex-col gap-4"
                  style={{ padding: '0 20px 16px 48px', transition: 'all 0.2s ease' }}
                >
                  {session.description && (
                    <RichTextDisplay
                      html={session.description}
                      className="text-gray-500 text-sm"
                    />
                  )}
                  <LocationBlock location={session.location ?? null} />
                  <LeadersBlock leaders={session.leaders ?? []} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

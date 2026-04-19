'use client';

import type { ParticipantSession } from '@/lib/types/participant';

/* ─── Helpers ─────────────────────────────────────────────────────────── */

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

/* ─── Status dot ─────────────────────────────────────────────────────── */

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

/* ─── Status badge ────────────────────────────────────────────────────── */

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

/* ─── SessionTimeline ─────────────────────────────────────────────────── */

interface SessionTimelineProps {
  sessions: ParticipantSession[];
}

export function SessionTimeline({ sessions }: SessionTimelineProps) {
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
        {sessions.map((session, i) => (
          <div
            key={session.id}
            className="flex items-center gap-4"
            style={{
              padding: '14px 20px',
              borderBottom: i < sessions.length - 1 ? '1px solid #F3F4F6' : undefined,
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

            {/* Badge */}
            <StatusBadge session={session} />
          </div>
        ))}
      </div>
    </div>
  );
}

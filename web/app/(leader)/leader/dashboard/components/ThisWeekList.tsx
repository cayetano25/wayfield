'use client';

import Link from 'next/link';
import type { LeaderDashboardSession } from '@/lib/types/leader';

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function getDayParts(dateStr: string): { abbr: string; num: string } {
  const d = new Date(dateStr);
  return {
    abbr: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    num: String(d.getDate()),
  };
}

function formatTime(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  return `${start.toLocaleTimeString('en-US', opts)} – ${end.toLocaleTimeString('en-US', opts)}`;
}

/* ─── Row ─────────────────────────────────────────────────────────────── */

function WeekRow({ session }: { session: LeaderDashboardSession }) {
  const { abbr, num } = getDayParts(session.start_at);

  return (
    <div
      className="flex items-center gap-4"
      style={{ padding: '12px 20px', borderBottom: '1px solid #F3F4F6' }}
    >
      {/* Day badge */}
      <div
        className="shrink-0 flex flex-col items-center justify-center rounded-lg font-heading"
        style={{
          width: 40,
          height: 48,
          backgroundColor: '#EFF6FF',
          color: '#3B82F6',
        }}
      >
        <span className="font-semibold leading-none" style={{ fontSize: 10 }}>
          {abbr}
        </span>
        <span className="font-bold leading-none mt-0.5" style={{ fontSize: 18 }}>
          {num}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className="font-sans font-semibold truncate"
          style={{ fontSize: 14, color: '#2E2E2E' }}
        >
          {session.title}
        </p>
        <p className="font-sans mt-0.5" style={{ fontSize: 12, color: '#9CA3AF' }}>
          {formatTime(session.start_at, session.end_at)}
          {' · '}
          <span style={{ color: '#6B7280' }}>{session.enrolled_count} enrolled</span>
        </p>
      </div>

      {/* View link */}
      <Link
        href={`/leader/sessions/${session.session_id}`}
        className="font-sans font-semibold shrink-0 hover:underline"
        style={{ fontSize: 13, color: '#0FA3B1' }}
      >
        View →
      </Link>
    </div>
  );
}

/* ─── ThisWeekList ────────────────────────────────────────────────────── */

interface ThisWeekListProps {
  sessions: LeaderDashboardSession[];
}

export function ThisWeekList({ sessions }: ThisWeekListProps) {
  return (
    <div>
      <h2 className="font-heading font-bold mb-3" style={{ fontSize: 18, color: '#2E2E2E' }}>
        This Week
      </h2>

      <div
        className="bg-white overflow-hidden"
        style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        {sessions.length === 0 ? (
          <p
            className="font-sans text-center py-8"
            style={{ fontSize: 13, color: '#9CA3AF' }}
          >
            No more sessions this week
          </p>
        ) : (
          sessions.map((s, i) => (
            <div key={s.session_id} style={i === sessions.length - 1 ? { borderBottom: 'none' } : {}}>
              <WeekRow session={s} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

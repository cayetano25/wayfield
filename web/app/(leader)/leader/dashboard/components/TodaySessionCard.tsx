'use client';

import Link from 'next/link';
import { Clock, MapPin, MessageSquare, Users } from 'lucide-react';
import type { LeaderDashboardSession } from '@/lib/types/leader';

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function formatTime(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  return `${start.toLocaleTimeString('en-US', opts)} – ${end.toLocaleTimeString('en-US', opts)}`;
}

function formatMessagingWindow(opensAt: string | null, closesAt: string | null): string {
  if (!opensAt) return 'Messaging window not available';
  const open = new Date(opensAt);
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
  return `Opens at ${open.toLocaleTimeString('en-US', opts)}`;
}

/* ─── Session card ────────────────────────────────────────────────────── */

function SessionCard({ session }: { session: LeaderDashboardSession }) {
  const { messaging_window } = session;
  const atCapacity = session.capacity !== null && session.enrolled_count >= session.capacity;

  return (
    <div
      className="bg-white overflow-hidden flex"
      style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minHeight: 180 }}
    >
      {/* Left: teal gradient — fixed 180px */}
      <div
        className="shrink-0 flex flex-col items-center justify-center gap-1"
        style={{
          width: 180,
          background: 'linear-gradient(135deg, #0FA3B1 0%, #0074A6 100%)',
          padding: '20px 16px',
        }}
      >
        {session.is_live && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-sans font-semibold mb-2"
            style={{ fontSize: 10, backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: 6, height: 6, backgroundColor: '#10B981' }}
            />
            LIVE NOW
          </span>
        )}
        {/* Attendance counter */}
        <div className="text-center">
          <div className="font-heading font-bold leading-none" style={{ fontSize: 40, color: 'white' }}>
            {session.checked_in_count}
          </div>
          <div
            className="font-sans font-semibold uppercase mt-1"
            style={{ fontSize: 11, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.7)' }}
          >
            checked in
          </div>
          <div className="font-sans mt-0.5" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            of {session.enrolled_count} enrolled
          </div>
        </div>
      </div>

      {/* Right: content */}
      <div className="flex-1 flex flex-col" style={{ padding: '16px 20px' }}>
        {/* Workshop label */}
        <p
          className="font-sans font-semibold uppercase mb-1"
          style={{ fontSize: 10, letterSpacing: '0.06em', color: '#9CA3AF' }}
        >
          {session.workshop_title}
        </p>

        {/* Session title */}
        <h3
          className="font-heading font-bold mb-3 leading-snug"
          style={{ fontSize: 18, color: '#2E2E2E' }}
        >
          {session.title}
        </h3>

        {/* Time + location */}
        <div className="flex flex-col gap-1.5 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" style={{ color: '#9CA3AF' }} />
            <span className="font-sans" style={{ fontSize: 13, color: '#6B7280' }}>
              {formatTime(session.start_at, session.end_at)}
            </span>
          </div>
          {session.location_display && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 shrink-0" style={{ color: '#9CA3AF' }} />
              <span className="font-sans" style={{ fontSize: 13, color: '#6B7280' }}>
                {session.location_display}
              </span>
            </div>
          )}
          {atCapacity && (
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 shrink-0" style={{ color: '#E67E22' }} />
              <span className="font-sans font-semibold" style={{ fontSize: 12, color: '#E67E22' }}>
                At capacity ({session.capacity})
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto flex-wrap">
          <Link
            href={`/leader/sessions/${session.session_id}/roster`}
            className="inline-flex items-center gap-1.5 font-sans font-semibold rounded-lg transition-colors"
            style={{
              fontSize: 13,
              padding: '8px 16px',
              backgroundColor: '#0FA3B1',
              color: 'white',
            }}
          >
            View Roster →
          </Link>

          {/* Send message — disabled with tooltip if window closed */}
          <div className="relative group">
            <button
              type="button"
              disabled={!messaging_window.is_open}
              className="inline-flex items-center gap-1.5 font-sans font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                fontSize: 13,
                padding: '8px 16px',
                backgroundColor: 'white',
                color: '#374151',
                border: '1px solid #E5E7EB',
              }}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Send Message
            </button>
            {!messaging_window.is_open && (
              <div
                className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10 pointer-events-none"
                style={{ minWidth: 200 }}
              >
                <div
                  className="font-sans rounded-lg px-3 py-2"
                  style={{
                    fontSize: 12,
                    backgroundColor: '#1F2937',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  }}
                >
                  {formatMessagingWindow(
                    messaging_window.opens_at,
                    messaging_window.closes_at,
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── TodaySessionCard ────────────────────────────────────────────────── */

interface TodaySessionCardProps {
  sessions: LeaderDashboardSession[];
}

export function TodaySessionCard({ sessions }: TodaySessionCardProps) {
  if (sessions.length === 0) {
    return (
      <div
        className="bg-white flex flex-col items-center text-center"
        style={{ borderRadius: 12, padding: '32px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        <p className="font-heading font-semibold mb-1" style={{ fontSize: 16, color: '#2E2E2E' }}>
          No sessions today
        </p>
        <p className="font-sans" style={{ fontSize: 13, color: '#9CA3AF' }}>
          Check your upcoming sessions below.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sessions.map((s) => (
        <SessionCard key={s.session_id} session={s} />
      ))}
    </div>
  );
}

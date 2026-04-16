'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, MapPin, MessageSquare, Users } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api/client';
import type { LeaderDashboardSession, RosterParticipant } from '@/lib/types/leader';

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

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

/* ─── Participant row ─────────────────────────────────────────────────── */

interface ParticipantRowProps {
  participant: RosterParticipant;
  sessionId: number;
  onCheckedIn: (userId: number) => void;
}

function ParticipantRow({ participant, sessionId, onCheckedIn }: ParticipantRowProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user, attendance } = participant;
  const isCheckedIn = attendance.status === 'checked_in';
  const isNoShow = attendance.status === 'no_show';

  const handleCheckIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await apiPost(`/sessions/${sessionId}/attendance/${user.id}/leader-check-in`);
      onCheckedIn(user.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Check-in failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3"
      style={{ padding: '10px 20px', borderBottom: '1px solid #F3F4F6' }}
    >
      {/* Avatar */}
      <div
        className="shrink-0 flex items-center justify-center rounded-full font-sans font-bold"
        style={{ width: 30, height: 30, backgroundColor: '#E0F2FE', color: '#0369A1', fontSize: 11 }}
      >
        {initials(user.first_name, user.last_name)}
      </div>

      {/* Name */}
      <span className="flex-1 font-sans" style={{ fontSize: 13, color: '#374151' }}>
        {user.first_name} {user.last_name}
      </span>

      {/* Error hint */}
      {error && (
        <span className="font-sans" style={{ fontSize: 11, color: '#E94F37' }}>
          {error}
        </span>
      )}

      {/* Status badge or check-in button */}
      {isCheckedIn ? (
        <span
          className="font-sans font-semibold rounded-full"
          style={{ fontSize: 10, padding: '3px 10px', backgroundColor: '#D1FAE5', color: '#065F46' }}
        >
          Checked In
        </span>
      ) : isNoShow ? (
        <span
          className="font-sans font-semibold rounded-full"
          style={{ fontSize: 10, padding: '3px 10px', backgroundColor: '#FEE2E2', color: '#B91C1C' }}
        >
          No Show
        </span>
      ) : (
        <button
          type="button"
          onClick={handleCheckIn}
          disabled={loading}
          className="font-sans font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontSize: 12, padding: '5px 14px', backgroundColor: '#0FA3B1', color: 'white' }}
        >
          {loading ? '…' : 'Check In'}
        </button>
      )}
    </div>
  );
}

/* ─── Participants panel ──────────────────────────────────────────────── */

interface ParticipantsPanelProps {
  sessionId: number;
}

function ParticipantsPanel({ sessionId }: ParticipantsPanelProps) {
  const [roster, setRoster] = useState<RosterParticipant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    setError(false);
    try {
      const res = await apiGet<{ data: RosterParticipant[] }>(`/sessions/${sessionId}/roster`);
      setRoster(res.data);
      setLoaded(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loaded, sessionId]);

  // Load on first render of this panel
  useEffect(() => { load(); }, [load]);

  const handleCheckedIn = (userId: number) => {
    setRoster((prev) =>
      prev
        ? prev.map((p) =>
            p.user.id === userId
              ? {
                  ...p,
                  attendance: {
                    ...p.attendance,
                    status: 'checked_in' as const,
                    checked_in_at: new Date().toISOString(),
                  },
                }
              : p,
          )
        : prev,
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '16px 20px' }}>
        <p className="font-sans" style={{ fontSize: 13, color: '#9CA3AF' }}>
          Loading participants…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px 20px' }}>
        <p className="font-sans" style={{ fontSize: 13, color: '#E94F37' }}>
          Could not load participants.{' '}
          <button
            type="button"
            onClick={() => setLoaded(false)}
            className="underline"
            style={{ color: '#0FA3B1' }}
          >
            Retry
          </button>
        </p>
      </div>
    );
  }

  if (!roster || roster.length === 0) {
    return (
      <div style={{ padding: '16px 20px' }}>
        <p className="font-sans" style={{ fontSize: 13, color: '#9CA3AF' }}>
          No participants enrolled.
        </p>
      </div>
    );
  }

  return (
    <div>
      {roster.map((p) => (
        <ParticipantRow
          key={p.user.id}
          participant={p}
          sessionId={sessionId}
          onCheckedIn={handleCheckedIn}
        />
      ))}
    </div>
  );
}

/* ─── Session card ────────────────────────────────────────────────────── */

function SessionCard({ session }: { session: LeaderDashboardSession }) {
  const { messaging_window } = session;
  const atCapacity = session.capacity !== null && session.enrolled_count >= session.capacity;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="bg-white overflow-hidden"
      style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      {/* Main card row */}
      <div className="flex" style={{ minHeight: 180 }}>
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
            {session.session_title}
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

      {/* Participants expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between font-sans font-semibold transition-colors hover:bg-gray-50"
        style={{
          padding: '10px 20px',
          fontSize: 13,
          color: '#0FA3B1',
          borderTop: '1px solid #F3F4F6',
          background: 'none',
        }}
      >
        <span>
          Participants ({session.enrolled_count})
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Expanded participant list */}
      {expanded && (
        <div style={{ borderTop: '1px solid #F3F4F6' }}>
          <ParticipantsPanel sessionId={session.session_id} />
        </div>
      )}
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

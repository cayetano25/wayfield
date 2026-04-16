'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api/client';
import type { LeaderDashboardSession, RosterParticipant } from '@/lib/types/leader';

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
      style={{ padding: '9px 20px', borderBottom: '1px solid #F9FAFB' }}
    >
      {/* Avatar */}
      <div
        className="shrink-0 flex items-center justify-center rounded-full font-sans font-bold"
        style={{ width: 28, height: 28, backgroundColor: '#E0F2FE', color: '#0369A1', fontSize: 10 }}
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

      {/* Status or check-in button */}
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

function ParticipantsPanel({ sessionId }: { sessionId: number }) {
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
      <div style={{ padding: '12px 20px' }}>
        <p className="font-sans" style={{ fontSize: 12, color: '#9CA3AF' }}>
          Loading participants…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '12px 20px' }}>
        <p className="font-sans" style={{ fontSize: 12, color: '#E94F37' }}>
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
      <div style={{ padding: '12px 20px' }}>
        <p className="font-sans" style={{ fontSize: 12, color: '#9CA3AF' }}>
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

/* ─── Row ─────────────────────────────────────────────────────────────── */

function WeekRow({ session }: { session: LeaderDashboardSession }) {
  const { abbr, num } = getDayParts(session.start_at);
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      {/* Main row */}
      <div
        className="flex items-center gap-4"
        style={{ padding: '12px 20px', borderBottom: expanded ? 'none' : '1px solid #F3F4F6' }}
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
            {session.session_title}
          </p>
          <p className="font-sans mt-0.5" style={{ fontSize: 12, color: '#9CA3AF' }}>
            {formatTime(session.start_at, session.end_at)}
            {' · '}
            <span style={{ color: '#6B7280' }}>{session.enrolled_count} enrolled</span>
          </p>
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="font-sans font-semibold shrink-0 flex items-center gap-1 transition-colors hover:opacity-70"
          style={{ fontSize: 13, color: '#0FA3B1', background: 'none', border: 'none' }}
        >
          Participants
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Expanded participants */}
      {expanded && (
        <div style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
          <ParticipantsPanel sessionId={session.session_id} />
        </div>
      )}
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

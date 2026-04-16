'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api/client';
import type { LeaderDashboardSession, RosterParticipant } from '@/lib/types/leader';

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(startAt: string): string {
  const d = new Date(startAt);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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

/* ─── Session row ─────────────────────────────────────────────────────── */

function SessionRow({
  session,
  isLast,
}: {
  session: LeaderDashboardSession;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const atCapacity = session.capacity !== null && session.enrolled_count >= session.capacity;

  return (
    <div style={{ borderBottom: isLast && !expanded ? undefined : '1px solid #F3F4F6' }}>
      {/* Main row */}
      <div
        className="grid items-center"
        style={{ gridTemplateColumns: '2fr 2fr 1.5fr 1fr auto', padding: '13px 20px' }}
      >
        {/* Session name */}
        <p
          className="font-sans font-semibold truncate pr-4"
          style={{ fontSize: 13, color: '#2E2E2E' }}
        >
          {session.session_title}
        </p>

        {/* Workshop */}
        <p
          className="font-sans truncate pr-4"
          style={{ fontSize: 13, color: '#6B7280' }}
        >
          {session.workshop_title}
        </p>

        {/* Date */}
        <p className="font-sans" style={{ fontSize: 13, color: '#6B7280' }}>
          {formatDate(session.start_at)}
          <br />
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>
            {formatTime(session.start_at)}
          </span>
        </p>

        {/* Enrolled */}
        <p
          className="font-sans font-semibold"
          style={{ fontSize: 13, color: atCapacity ? '#E67E22' : '#374151' }}
        >
          {session.enrolled_count}
          {session.capacity !== null && (
            <span
              className="font-normal"
              style={{ color: atCapacity ? '#E67E22' : '#9CA3AF' }}
            >
              {' '}/{session.capacity}
            </span>
          )}
        </p>

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
        <div style={{ borderTop: '1px solid #F3F4F6', backgroundColor: '#FAFAFA' }}>
          <ParticipantsPanel sessionId={session.session_id} />
        </div>
      )}
    </div>
  );
}

/* ─── UpcomingTable ───────────────────────────────────────────────────── */

interface UpcomingTableProps {
  sessions: LeaderDashboardSession[];
}

export function UpcomingTable({ sessions }: UpcomingTableProps) {
  return (
    <div>
      <h2 className="font-heading font-bold mb-3" style={{ fontSize: 18, color: '#2E2E2E' }}>
        Upcoming
      </h2>

      <div
        className="bg-white overflow-hidden"
        style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        {/* Header row */}
        <div
          className="grid font-sans font-semibold uppercase"
          style={{
            gridTemplateColumns: '2fr 2fr 1.5fr 1fr auto',
            padding: '10px 20px',
            fontSize: 10,
            letterSpacing: '0.06em',
            color: '#9CA3AF',
            backgroundColor: '#F9FAFB',
            borderBottom: '1px solid #F3F4F6',
          }}
        >
          <span>Session Name</span>
          <span>Workshop</span>
          <span>Date</span>
          <span>Enrolled</span>
          <span />
        </div>

        {sessions.length === 0 ? (
          <p
            className="font-sans text-center py-8"
            style={{ fontSize: 13, color: '#9CA3AF' }}
          >
            No upcoming sessions
          </p>
        ) : (
          sessions.map((s, i) => (
            <SessionRow key={s.session_id} session={s} isLast={i === sessions.length - 1} />
          ))
        )}
      </div>
    </div>
  );
}

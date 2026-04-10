'use client';

import Link from 'next/link';
import type { LeaderDashboardSession } from '@/lib/types/leader';

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(startAt: string): string {
  const d = new Date(startAt);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
            gridTemplateColumns: '2fr 2fr 1.5fr 1fr',
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
        </div>

        {sessions.length === 0 ? (
          <p
            className="font-sans text-center py-8"
            style={{ fontSize: 13, color: '#9CA3AF' }}
          >
            No upcoming sessions
          </p>
        ) : (
          sessions.map((s, i) => {
            const atCapacity = s.capacity !== null && s.enrolled_count >= s.capacity;
            return (
              <div
                key={s.session_id}
                className="grid items-center"
                style={{
                  gridTemplateColumns: '2fr 2fr 1.5fr 1fr',
                  padding: '13px 20px',
                  borderBottom: i < sessions.length - 1 ? '1px solid #F3F4F6' : undefined,
                }}
              >
                {/* Session name */}
                <Link
                  href={`/leader/sessions/${s.session_id}`}
                  className="font-sans font-semibold hover:underline truncate pr-4"
                  style={{ fontSize: 13, color: '#2E2E2E' }}
                >
                  {s.title}
                </Link>

                {/* Workshop */}
                <p
                  className="font-sans truncate pr-4"
                  style={{ fontSize: 13, color: '#6B7280' }}
                >
                  {s.workshop_title}
                </p>

                {/* Date */}
                <p className="font-sans" style={{ fontSize: 13, color: '#6B7280' }}>
                  {formatDate(s.start_at)}
                  <br />
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {formatTime(s.start_at)}
                  </span>
                </p>

                {/* Enrolled */}
                <p
                  className="font-sans font-semibold"
                  style={{ fontSize: 13, color: atCapacity ? '#E67E22' : '#374151' }}
                >
                  {s.enrolled_count}
                  {s.capacity !== null && (
                    <span
                      className="font-normal"
                      style={{ color: atCapacity ? '#E67E22' : '#9CA3AF' }}
                    >
                      {' '}/{s.capacity}
                    </span>
                  )}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

'use client';

import { SessionCard } from './SessionCard';
import type { LeaderDashboardSession } from '@/lib/types/leader';

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
      {sessions.map(s => (
        <SessionCard key={s.session_id} session={s} />
      ))}
    </div>
  );
}

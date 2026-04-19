'use client';

import { SessionCard } from './SessionCard';
import type { LeaderDashboardSession } from '@/lib/types/leader';

interface ThisWeekListProps {
  sessions: LeaderDashboardSession[];
}

export function ThisWeekList({ sessions }: ThisWeekListProps) {
  return (
    <div>
      <h2 className="font-heading font-bold mb-3" style={{ fontSize: 18, color: '#2E2E2E' }}>
        This Week
      </h2>

      {sessions.length === 0 ? (
        <div
          className="bg-white flex items-center justify-center"
          style={{ borderRadius: 12, padding: '32px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <p className="font-sans text-center" style={{ fontSize: 13, color: '#9CA3AF' }}>
            No more sessions this week
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sessions.map(s => (
            <SessionCard key={s.session_id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { apiGet } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { PendingInvitationBanner } from './components/PendingInvitationBanner';
import { TodaySessionCard } from './components/TodaySessionCard';
import { ThisWeekList } from './components/ThisWeekList';
import { UpcomingTable } from './components/UpcomingTable';
import type { LeaderDashboard } from '@/lib/types/leader';

/* --- Skeleton ---------------------------------------------------------- */

function Skeleton({ height, className = '' }: { height: number; className?: string }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{
        height,
        background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
        backgroundSize: '400% 100%',
        animation: 'leaderShimmer 1.4s infinite',
      }}
    />
  );
}

/* --- Error state ------------------------------------------------------- */

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="bg-white flex flex-col items-center text-center gap-4"
      style={{ borderRadius: 12, padding: '48px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      <AlertCircle className="w-10 h-10" style={{ color: '#E94F37' }} />
      <div>
        <p className="font-heading font-semibold mb-1" style={{ color: '#2E2E2E' }}>
          Could not load your dashboard
        </p>
        <p className="font-sans text-sm" style={{ color: '#6B7280' }}>
          Check your connection and try again.
        </p>
      </div>
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/* --- Page -------------------------------------------------------------- */

export default function LeaderDashboardPage() {
  const [data, setData] = useState<LeaderDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    setError(false);
    apiGet<LeaderDashboard>('/leader/dashboard')
      .then((res) => setData(res))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const hasToday = (data?.today.sessions ?? []).length > 0;
  const hasThisWeek = (data?.this_week ?? []).length > 0;
  const hasUpcoming = (data?.upcoming ?? []).length > 0;

  return (
    <>
      <style>{`
        @keyframes leaderShimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col gap-6">
            <Skeleton height={72} />
            <Skeleton height={180} />
            <Skeleton height={200} />
            <Skeleton height={160} />
          </div>
        ) : error ? (
          <ErrorState onRetry={fetchDashboard} />
        ) : (
          <div className="flex flex-col gap-8">
            {/* Section 1 — Pending invitations */}
            {data && (data.pending_invitations ?? []).length > 0 && (
              <PendingInvitationBanner
                invitations={data.pending_invitations}
                onResolved={fetchDashboard}
              />
            )}

            {/* Section 2 — Today's sessions */}
            <div>
              <h2
                className="font-heading font-bold mb-4"
                style={{ fontSize: 18, color: '#2E2E2E' }}
              >
                Today
              </h2>
              <TodaySessionCard sessions={data?.today.sessions ?? []} />
            </div>

            {/* Section 3 — This week */}
            {hasThisWeek && (
              <ThisWeekList sessions={data?.this_week ?? []} />
            )}

            {/* Section 4 — Upcoming */}
            {hasUpcoming && (
              <UpcomingTable sessions={data?.upcoming ?? []} />
            )}

            {/* Empty state when no sessions at all */}
            {!hasToday && !hasThisWeek && !hasUpcoming && (
              <div
                className="bg-white flex flex-col items-center text-center"
                style={{ borderRadius: 12, padding: '48px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
              >
                <div className="flex items-center justify-center mb-5" style={{ fontSize: 48 }}>
                  📋
                </div>
                <h2
                  className="font-heading font-bold mb-2"
                  style={{ fontSize: 20, color: '#2E2E2E' }}
                >
                  No sessions scheduled
                </h2>
                <p
                  className="font-sans leading-relaxed max-w-xs"
                  style={{ fontSize: 14, color: '#6B7280' }}
                >
                  You&apos;ll see your upcoming sessions here once you&apos;ve been assigned to a workshop.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, AlertCircle, CalendarDays, X } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { ActiveWorkshopCard } from './components/ActiveWorkshopCard';
import { SessionTimeline } from './components/SessionTimeline';
import { WorkshopInfoCard } from '@/components/workshops/WorkshopInfoCard';
import { OtherWorkshopsGrid } from './components/OtherWorkshopsGrid';
import type { ParticipantDashboard } from '@/lib/types/participant';
import toast from 'react-hot-toast';

/* --- Skeleton ---------------------------------------------------------- */

function Skeleton({ height, className = '' }: { height: number; className?: string }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{
        height,
        background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
        backgroundSize: '400% 100%',
        animation: 'participantShimmer 1.4s infinite',
      }}
    />
  );
}

/* --- Empty state ------------------------------------------------------- */

function EmptyState({ onJoined }: { onJoined: (workshopId?: number) => void }) {
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setJoining(true);
    try {
      const result = await apiPost<{ workshop?: { id: number } }>('/workshops/join', { join_code: trimmed });
      setCode('');
      setJoinOpen(false);
      const wid = result?.workshop?.id;
      if (wid) {
        router.push(`/my-workshops?joined=1&workshop=${wid}`);
      } else {
        onJoined();
      }
    } catch {
      toast.error('Invalid join code. Please check with your organizer.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <>
      <div
        className="bg-white flex flex-col items-center text-center"
        style={{ borderRadius: 12, padding: '48px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-center mb-5" style={{ fontSize: 48 }}>
          🎯
        </div>
        <h2
          className="font-heading font-bold mb-2"
          style={{ fontSize: 20, color: '#2E2E2E' }}
        >
          You haven&apos;t joined any workshops yet
        </h2>
        <p className="font-sans mb-8 max-w-xs leading-relaxed" style={{ fontSize: 14, color: '#6B7280' }}>
          Ask your workshop organizer for a join code to get started.
        </p>
        <Button size="lg" onClick={() => setJoinOpen(true)}>
          <Plus className="w-4 h-4" />
          Join a Workshop
        </Button>
      </div>

      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Join a Workshop"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setJoinOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleJoin} loading={joining} disabled={!code.trim()}>
              Join
            </Button>
          </>
        }
      >
        <p className="text-sm text-medium-gray mb-4 leading-relaxed">
          Ask your organizer for the workshop join code to get access.
        </p>
        <Input
          label="Join Code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. ABC123"
          className="font-mono tracking-widest"
          onKeyDown={(e) => { if (e.key === 'Enter') void handleJoin(); }}
        />
      </Modal>
    </>
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
          Could not load your workshops
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

/* --- Joined banner ----------------------------------------------------- */

interface JoinedBannerProps {
  workshopTitle: string;
  isSessionBased: boolean;
  selectHref: string;
  onDismiss: () => void;
}

function JoinedBanner({ workshopTitle, isSessionBased, selectHref, onDismiss }: JoinedBannerProps) {
  return (
    <div
      className="flex items-start justify-between gap-4 rounded-xl mb-6"
      style={{
        backgroundColor: '#0FA3B1',
        padding: '16px 20px',
        boxShadow: '0 4px 16px rgba(15,163,177,0.25)',
      }}
    >
      <div className="flex-1 min-w-0">
        <p
          className="font-heading font-bold mb-1"
          style={{ fontSize: 16, color: 'white' }}
        >
          🎉 Welcome to {workshopTitle}!
        </p>
        <p className="font-sans" style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
          {isSessionBased
            ? 'Now choose your sessions to build your schedule.'
            : 'Your schedule is set. See you there!'}
        </p>
        {isSessionBased && (
          <Link
            href={selectHref}
            className="inline-block font-sans font-bold rounded-lg mt-3"
            style={{
              fontSize: 14,
              padding: '8px 18px',
              backgroundColor: 'white',
              color: '#0FA3B1',
            }}
            onClick={onDismiss}
          >
            Select Sessions →
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 mt-0.5"
        aria-label="Dismiss"
        style={{ color: 'rgba(255,255,255,0.7)' }}
      >
        <X size={18} />
      </button>
    </div>
  );
}

/* --- Quick Actions row -------------------------------------------------- */

function QuickActions({ workshopId, hasSelections }: { workshopId: number; hasSelections: boolean }) {
  return (
    <div className="flex gap-3 mb-6">
      <Link
        href={`/my-workshops/${workshopId}/select-sessions`}
        className="inline-flex items-center gap-2 font-sans font-semibold rounded-lg transition-colors hover:bg-[#F0FDFF]"
        style={{
          fontSize: 14,
          height: 40,
          padding: '0 16px',
          color: '#0FA3B1',
          border: '1.5px solid #0FA3B1',
          backgroundColor: 'white',
        }}
      >
        <CalendarDays size={15} />
        {hasSelections ? 'Adjust Sessions' : 'Select Sessions'}
      </Link>
    </div>
  );
}

/* --- Page -------------------------------------------------------------- */

function MyWorkshopsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<ParticipantDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // "just joined" banner state
  const [joinedWorkshopId, setJoinedWorkshopId] = useState<number | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    setError(false);
    apiGet<ParticipantDashboard>('/me/dashboard')
      .then((res) => setData(res))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Read ?joined=1&workshop={id} on mount
  useEffect(() => {
    const joined = searchParams.get('joined');
    const wid = searchParams.get('workshop');
    if (joined === '1' && wid) {
      setJoinedWorkshopId(Number(wid));
      setBannerVisible(true);
      // Strip query params from URL
      router.replace('/my-workshops', { scroll: false });
    }
  }, [searchParams, router]);

  // Auto-dismiss banner after 8 seconds
  useEffect(() => {
    if (bannerVisible) {
      bannerTimerRef.current = setTimeout(() => setBannerVisible(false), 8000);
    }
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [bannerVisible]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const isEmpty =
    !loading &&
    !error &&
    data?.active_workshop === null &&
    (data?.other_workshops ?? []).length === 0;

  // Resolve the joined workshop from loaded data
  const joinedWorkshop =
    bannerVisible && joinedWorkshopId
      ? (data?.active_workshop?.workshop_id === joinedWorkshopId
          ? data.active_workshop
          : null)
      : null;

  // Show Quick Actions for session-based workshops that are not yet over
  const showQuickActions = (() => {
    if (loading || error) return false;
    const aw = data?.active_workshop;
    if (!aw || aw.workshop_type !== 'session_based') return false;
    if (!aw.end_date) return true; // no end date — assume ongoing
    return aw.end_date >= new Date().toISOString().slice(0, 10);
  })();

  return (
    <>
      <style>{`
        @keyframes participantShimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Joined banner */}
        {bannerVisible && joinedWorkshopId && (
          <JoinedBanner
            workshopTitle={joinedWorkshop?.title ?? 'your new workshop'}
            isSessionBased={
              (joinedWorkshop?.workshop_type ?? '') === 'session_based'
            }
            selectHref={`/my-workshops/${joinedWorkshopId}/select-sessions`}
            onDismiss={() => setBannerVisible(false)}
          />
        )}

        {loading ? (
          <div className="flex flex-col gap-6">
            <Skeleton height={220} />
            <Skeleton height={200} />
            <Skeleton height={160} />
          </div>
        ) : error ? (
          <ErrorState onRetry={fetchDashboard} />
        ) : isEmpty ? (
          <EmptyState onJoined={fetchDashboard} />
        ) : (
          <div className="flex flex-col gap-6">
            {/* Quick Actions row */}
            {showQuickActions && data?.active_workshop && (
              <QuickActions
                workshopId={data.active_workshop.workshop_id}
                hasSelections={data.active_workshop.total_selected > 0}
              />
            )}

            {/* Section 1 — Active workshop hero */}
            {data?.active_workshop && (
              <ActiveWorkshopCard workshop={data.active_workshop} />
            )}

            {/* Section 2+3 — Schedule + workshop info two-column */}
            {data?.active_workshop && (
              <div
                className="bg-white rounded-2xl overflow-hidden"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
              >
                <div className="p-6 lg:p-8">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-5">
                    <h2
                      className="font-heading font-bold text-gray-900"
                      style={{ fontSize: 18 }}
                    >
                      Your Schedule
                    </h2>
                    {data.active_workshop.sessions.length > 0 && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono">
                        {data.active_workshop.sessions.filter((s) => {
                          const now = new Date();
                          return s.attendance_status === 'checked_in' || new Date(s.end_at) < now;
                        }).length}{' '}
                        / {data.active_workshop.sessions.length} complete
                      </span>
                    )}
                  </div>

                  {/* Two-column */}
                  <div className="flex gap-10 items-start">
                    {/* Left: session timeline */}
                    <div className="flex-1 min-w-0">
                      {data.active_workshop.sessions.length > 0 ? (
                        <SessionTimeline sessions={data.active_workshop.sessions} />
                      ) : (
                        <p className="text-sm text-gray-400">No sessions scheduled yet.</p>
                      )}

                      {/* Mobile: Workshop Info below schedule */}
                      <div className="lg:hidden mt-8">
                        <WorkshopInfoCard
                          logistics={data.active_workshop.logistics}
                          workshopId={data.active_workshop.workshop_id}
                          publicSlug={data.active_workshop.public_slug}
                          publicPageEnabled={data.active_workshop.public_page_enabled}
                        />
                      </div>
                    </div>

                    {/* Right: sticky workshop info */}
                    <div className="hidden lg:block w-80 flex-shrink-0 sticky top-6">
                      <WorkshopInfoCard
                        logistics={data.active_workshop.logistics}
                        workshopId={data.active_workshop.workshop_id}
                        publicSlug={data.active_workshop.public_slug}
                        publicPageEnabled={data.active_workshop.public_page_enabled}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 4 — Other workshops + Discover strip */}
            <OtherWorkshopsGrid
              workshops={data!.other_workshops}
              onJoined={fetchDashboard}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default function MyWorkshopsPage() {
  return (
    <Suspense>
      <MyWorkshopsPageInner />
    </Suspense>
  );
}

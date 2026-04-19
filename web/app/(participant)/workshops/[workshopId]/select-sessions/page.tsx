'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, CalendarX } from 'lucide-react';
import { useSessionSelection } from '@/lib/hooks/useSessionSelection';
import type { SelectionDay } from '@/lib/types/session-selection';
import { DayTabBar } from './components/DayTabBar';
import { MyScheduleSheet } from './components/MyScheduleSheet';
import { SelectionConfirmation } from './components/SelectionConfirmation';
import { SelectionPageHeader } from './components/SelectionPageHeader';
import { SessionList } from './components/SessionList';

/* ── Skeleton shimmer ───────────────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div
      style={{
        height: 100,
        borderRadius: 12,
        marginBottom: 8,
        background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EBEE 50%, #F3F4F6 75%)',
        backgroundSize: '400% 100%',
        animation: 'selectionShimmer 1.4s infinite',
      }}
    />
  );
}

function SkeletonTab() {
  return (
    <div
      style={{
        width: 52,
        height: 32,
        borderRadius: 6,
        backgroundColor: '#F3F4F6',
        flexShrink: 0,
        animation: 'selectionShimmer 1.4s infinite',
      }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <>
      <style>{`
        @keyframes selectionShimmer {
          0%   { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>

      {/* Tab skeleton */}
      <div
        className="bg-white shrink-0 flex items-center gap-2 px-4"
        style={{ height: 48, borderBottom: '1px solid #E5E7EB' }}
      >
        {[1, 2, 3, 4].map((i) => (
          <SkeletonTab key={i} />
        ))}
      </div>

      {/* Card skeletons */}
      <div className="flex-1 overflow-hidden px-4 pt-4" style={{ backgroundColor: '#F5F5F5' }}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </>
  );
}

/* ── Error state ────────────────────────────────────────────────────────── */

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className="bg-white flex flex-col items-center text-center gap-4"
        style={{ borderRadius: 12, padding: '40px 32px', maxWidth: 360 }}
      >
        <AlertCircle size={36} style={{ color: '#E94F37' }} />
        <div>
          <p className="font-heading font-semibold" style={{ color: '#2E2E2E', marginBottom: 4 }}>
            Could not load sessions
          </p>
          <p className="font-sans" style={{ fontSize: 13, color: '#6B7280' }}>
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="font-sans font-semibold rounded-lg px-6"
          style={{ height: 40, backgroundColor: '#F3F4F6', color: '#374151', fontSize: 14 }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

/* ── Not registered state ───────────────────────────────────────────────── */

function NotRegisteredState() {
  const router = useRouter();
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className="bg-white flex flex-col items-center text-center gap-4"
        style={{ borderRadius: 12, padding: '40px 32px', maxWidth: 360 }}
      >
        <CalendarX size={36} style={{ color: '#9CA3AF' }} />
        <div>
          <p className="font-heading font-semibold" style={{ color: '#2E2E2E', marginBottom: 4 }}>
            Not registered
          </p>
          <p className="font-sans" style={{ fontSize: 13, color: '#6B7280' }}>
            You&apos;re not registered in this workshop.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/my-workshops')}
          className="font-sans font-semibold rounded-lg px-6"
          style={{ height: 40, backgroundColor: '#0FA3B1', color: 'white', fontSize: 14 }}
        >
          Go to My Workshops →
        </button>
      </div>
    </div>
  );
}

/* ── Event-based workshop state ─────────────────────────────────────────── */

function EventBasedState() {
  const router = useRouter();
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className="bg-white flex flex-col items-center text-center gap-4"
        style={{ borderRadius: 12, padding: '40px 32px', maxWidth: 360 }}
      >
        <span style={{ fontSize: 40 }}>📅</span>
        <div>
          <p className="font-heading font-semibold" style={{ color: '#2E2E2E', marginBottom: 4 }}>
            No selection needed
          </p>
          <p className="font-sans" style={{ fontSize: 13, color: '#6B7280' }}>
            This workshop doesn&apos;t require session selection.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/my-workshops')}
          className="font-sans font-semibold rounded-lg px-6"
          style={{ height: 40, backgroundColor: '#0FA3B1', color: 'white', fontSize: 14 }}
        >
          View My Schedule →
        </button>
      </div>
    </div>
  );
}

/* ── Build session counts by day ────────────────────────────────────────── */

function buildDayCounts(
  days: SelectionDay[],
  selectedIds: number[],
): Record<string, { total: number; selected: number }> {
  const selectedSet = new Set(selectedIds);
  const result: Record<string, { total: number; selected: number }> = {};
  for (const day of days) {
    let total = 0;
    let selected = 0;
    for (const slot of day.time_slots) {
      for (const s of slot.sessions) {
        total++;
        if (selectedSet.has(s.session_id)) selected++;
      }
    }
    result[day.date] = { total, selected };
  }
  return result;
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function SelectSessionsPage() {
  const params = useParams();
  const router = useRouter();
  const workshopId = Number(params.workshopId as string);

  const {
    data,
    isLoading,
    error,
    toggleSession,
    getEffectiveState,
    selectedCount,
    pendingSessionIds,
    sessionErrors,
    clearSessionError,
    selectedSessions,
  } = useSessionSelection(workshopId);

  const [activeDayDate, setActiveDayDate] = useState<string>('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Set initial active day once data loads
  useEffect(() => {
    if (data && !activeDayDate) {
      setActiveDayDate(data.days[0]?.date ?? '');
    }
  }, [data, activeDayDate]);

  async function handleConfirm() {
    setIsConfirming(true);
    // Selections are already saved optimistically — brief polish delay
    await new Promise<void>((r) => setTimeout(r, 600));
    setIsConfirming(false);
    setIsConfirmed(true);
  }

  function handleDone() {
    router.push('/my-workshops');
  }

  // ── Render: confirmation overlay ──
  if (isConfirmed) {
    return (
      <SelectionConfirmation
        selectedSessions={selectedSessions}
        onBack={() => setIsConfirmed(false)}
      />
    );
  }

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <div
        className="flex flex-col"
        style={{ height: 'calc(100vh - 56px)', overflow: 'hidden', backgroundColor: '#F5F5F5' }}
      >
        {/* Placeholder header */}
        <div
          className="bg-white shrink-0"
          style={{ height: 80, borderBottom: '1px solid #E5E7EB' }}
        />
        <LoadingSkeleton />
      </div>
    );
  }

  // ── Error ──
  if (error || !data) {
    return (
      <div
        className="flex flex-col"
        style={{ height: 'calc(100vh - 56px)', overflow: 'hidden', backgroundColor: '#F5F5F5' }}
      >
        <ErrorState
          message={error ?? 'Unknown error'}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  // ── Not registered (403 results in error string, handle event_based here) ──
  if (data.workshop.workshop_type === 'event_based') {
    return (
      <div
        className="flex flex-col"
        style={{ height: 'calc(100vh - 56px)', overflow: 'hidden', backgroundColor: '#F5F5F5' }}
      >
        <EventBasedState />
      </div>
    );
  }

  const dayCounts = buildDayCounts(data.days, data.selected_session_ids);
  const effectiveActiveDate = activeDayDate || (data.days[0]?.date ?? '');

  // ── Main render ──
  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100vh - 56px)', overflow: 'hidden', backgroundColor: '#F5F5F5' }}
    >
      {/* Full-width header */}
      <SelectionPageHeader
        workshop={data.workshop}
        selectedCount={selectedCount}
        totalSelectable={data.selection_summary.total_selectable}
        onDone={handleDone}
      />

      {/* Body row: content + sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Left: day tabs + session list */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <DayTabBar
            days={data.days}
            activeDate={effectiveActiveDate}
            onDayChange={setActiveDayDate}
            sessionCountsByDay={dayCounts}
          />

          {/* Scrollable session list */}
          <div
            className="flex-1 overflow-y-auto min-h-0 px-4 md:px-6 pt-4 pb-24 md:pb-6"
            style={{ backgroundColor: '#F5F5F5' }}
          >
            <SessionList
              days={data.days}
              activeDayDate={effectiveActiveDate}
              onToggle={(sessionId, currentState) =>
                toggleSession(sessionId, currentState)
              }
              getEffectiveState={getEffectiveState}
              pendingSessionIds={pendingSessionIds}
              sessionErrors={sessionErrors}
              onClearError={clearSessionError}
              showAllDays={false}
            />
          </div>
        </div>

        {/* Right: MyScheduleSheet handles desktop sidebar + mobile bottom sheet */}
        <MyScheduleSheet
          selectedSessions={selectedSessions}
          workshopTitle={data.workshop.title}
          onDeselect={(sessionId) => {
            // Find and deselect the session
            const allSessions = data.days.flatMap((d) =>
              d.time_slots.flatMap((t) => t.sessions),
            );
            const session = allSessions.find((s) => s.session_id === sessionId);
            if (session) toggleSession(sessionId, 'selected');
          }}
          onConfirm={handleConfirm}
          isConfirming={isConfirming}
        />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useSessionSelection } from '@/lib/hooks/useSessionSelection';
import type { SelectionDay } from '@/lib/types/session-selection';
import { DayTabBar } from './components/DayTabBar';
import { MyScheduleSheet } from './components/MyScheduleSheet';
import { SelectionConfirmation } from './components/SelectionConfirmation';
import { SelectionPageHeader } from './components/SelectionPageHeader';
import { SessionList } from './components/SessionList';

/* -- Skeleton shimmer ----------------------------------------------------- */

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
      <div className="px-4 pt-4" style={{ backgroundColor: '#F5F5F5' }}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </>
  );
}

/* -- Error state ---------------------------------------------------------- */

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center p-8" style={{ minHeight: '40vh' }}>
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

/* -- Event-based workshop state ------------------------------------------- */

function EventBasedState() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-center p-8" style={{ minHeight: '40vh' }}>
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

/* -- Build session counts by day ------------------------------------------ */

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

/* -- Page ----------------------------------------------------------------- */

export default function SelectSessionsPage() {
  const params = useParams();
  const router = useRouter();
  const workshopId = Number(params.id as string);

  const {
    data,
    isLoading,
    error,
    toggleSession,
    getEffectiveState,
    selectedCount,
    slotCounts,
    pendingSessionIds,
    sessionErrors,
    clearSessionError,
    selectedSessions,
  } = useSessionSelection(workshopId);

  const [activeDayDate, setActiveDayDate] = useState<string>('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (data && !activeDayDate) {
      setActiveDayDate(data.days[0]?.date ?? '');
    }
  }, [data, activeDayDate]);

  async function handleConfirm() {
    setIsConfirming(true);
    await new Promise<void>((r) => setTimeout(r, 600));
    setIsConfirming(false);
    setIsConfirmed(true);
  }

  function handleDone() {
    router.push('/my-workshops');
  }

  // -- Confirmation overlay (fixed, full-screen) --
  if (isConfirmed) {
    return (
      <SelectionConfirmation
        selectedSessions={selectedSessions}
        onBack={() => setIsConfirmed(false)}
      />
    );
  }

  // -- Loading --
  if (isLoading) {
    return (
      <div style={{ backgroundColor: '#F5F5F5' }}>
        <div className="bg-white" style={{ height: 80, borderBottom: '1px solid #E5E7EB' }} />
        <LoadingSkeleton />
      </div>
    );
  }

  // -- Error --
  if (error || !data) {
    return <ErrorState message={error ?? 'Unknown error'} onRetry={() => window.location.reload()} />;
  }

  // -- Event-based (no session selection needed) --
  if (data.workshop.workshop_type === 'event_based') {
    return <EventBasedState />;
  }

  const dayCounts = buildDayCounts(data.days, data.selected_session_ids);
  const effectiveActiveDate = activeDayDate || (data.days[0]?.date ?? '');

  // -- Main render --
  return (
    <div style={{ backgroundColor: '#F5F5F5' }}>
      {/* Page header */}
      <SelectionPageHeader
        workshop={data.workshop}
        selectedCount={slotCounts.selected}
        totalSelectable={slotCounts.selectable}
        onDone={handleDone}
      />

      {/* Body: session list (left) + schedule sidebar (right, desktop only) */}
      <div className="flex" style={{ alignItems: 'flex-start' }}>

        {/* Left: sticky day tabs + session list */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Day tab bar — sticky below the nav */}
          <div style={{ position: 'sticky', top: 56, zIndex: 10 }}>
            <DayTabBar
              days={data.days}
              activeDate={effectiveActiveDate}
              onDayChange={setActiveDayDate}
              sessionCountsByDay={dayCounts}
            />
          </div>

          {/* Session list — natural height, page scrolls */}
          <div className="px-4 md:px-6 pt-4 pb-8" style={{ backgroundColor: '#F5F5F5' }}>
            <SessionList
              days={data.days}
              activeDayDate={effectiveActiveDate}
              onToggle={(sessionId, currentState) => toggleSession(sessionId, currentState)}
              getEffectiveState={getEffectiveState}
              pendingSessionIds={pendingSessionIds}
              sessionErrors={sessionErrors}
              onClearError={clearSessionError}
              showAllDays={false}
            />
          </div>

          {/* Mobile: confirm button below session list */}
          <div
            className="md:hidden px-4 pb-8"
            style={{ backgroundColor: '#F5F5F5' }}
          >
            <div
              className="bg-white rounded-xl p-4"
              style={{ border: '1px solid #E5E7EB' }}
            >
              <p className="font-sans text-sm mb-3" style={{ color: '#6B7280' }}>
                {selectedCount} session{selectedCount !== 1 ? 's' : ''} selected
              </p>
              <button
                type="button"
                onClick={selectedCount > 0 ? handleConfirm : undefined}
                disabled={isConfirming || selectedCount === 0}
                className="w-full font-sans font-bold rounded-lg flex items-center justify-center gap-2"
                style={{
                  height: 48,
                  fontSize: 15,
                  backgroundColor: selectedCount > 0 ? '#0FA3B1' : '#E5E7EB',
                  color: selectedCount > 0 ? 'white' : '#9CA3AF',
                  cursor: selectedCount > 0 && !isConfirming ? 'pointer' : 'default',
                }}
              >
                {isConfirming ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Confirm Selections'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: sticky schedule sidebar (desktop only) */}
        <MyScheduleSheet
          selectedSessions={selectedSessions}
          workshopTitle={data.workshop.title}
          onDeselect={(sessionId) => {
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

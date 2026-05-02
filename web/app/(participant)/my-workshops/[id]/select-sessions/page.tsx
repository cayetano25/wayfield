'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, CalendarDays, ChevronUp, X } from 'lucide-react';
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
        height: 260,
        borderRadius: 16,
        marginBottom: 8,
        background: 'linear-gradient(90deg, #F3F4F6 25%, #E9EBEE 50%, #F3F4F6 75%)',
        backgroundSize: '400% 100%',
        animation: 'selectionShimmer 1.4s infinite',
      }}
    />
  );
}

function SkeletonPill() {
  return (
    <div
      style={{
        width: 72,
        height: 52,
        borderRadius: 12,
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

      {/* Pill skeleton */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex gap-2">
          {[1, 2, 3, 4].map((i) => <SkeletonPill key={i} />)}
        </div>
      </div>

      {/* Card skeletons */}
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </>
  );
}

/* -- Error state ---------------------------------------------------------- */

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center p-8 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-2xl border border-gray-200 flex flex-col
        items-center text-center gap-4 p-10 max-w-sm w-full">
        <AlertCircle size={36} className="text-[#E94F37]" />
        <div>
          <p className="font-semibold font-[Sora] text-gray-900 mb-1">
            Could not load sessions
          </p>
          <p className="text-sm text-gray-500">{message}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="px-6 py-2 rounded-xl bg-gray-100 text-gray-700
            text-sm font-semibold hover:bg-gray-200 transition-colors"
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
    <div className="flex items-center justify-center p-8 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-2xl border border-gray-200 flex flex-col
        items-center text-center gap-4 p-10 max-w-sm w-full">
        <span style={{ fontSize: 40 }}>📅</span>
        <div>
          <p className="font-semibold font-[Sora] text-gray-900 mb-1">
            No selection needed
          </p>
          <p className="text-sm text-gray-500">
            This workshop doesn&apos;t require session selection.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/my-workshops')}
          className="px-6 py-2 rounded-xl bg-[#0FA3B1] text-white
            text-sm font-semibold hover:bg-[#0c8a96] transition-colors"
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
    slotCounts,
    pendingSessionIds,
    sessionErrors,
    clearSessionError,
    selectedSessions,
  } = useSessionSelection(workshopId);

  const [activeDayDate, setActiveDayDate]           = useState<string>('');
  const [isConfirmed, setIsConfirmed]               = useState(false);
  const [isConfirming, setIsConfirming]             = useState(false);
  const [showMobileSchedule, setShowMobileSchedule] = useState(false);

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

  // -- Confirmation overlay --
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
      <div>
        <div className="bg-white sticky top-14 z-20"
          style={{ height: 56, borderBottom: '1px solid #E5E7EB' }} />
        <LoadingSkeleton />
      </div>
    );
  }

  // -- Error --
  if (error || !data) {
    return <ErrorState message={error ?? 'Unknown error'} onRetry={() => window.location.reload()} />;
  }

  // -- Event-based --
  if (data.workshop.workshop_type === 'event_based') {
    return <EventBasedState />;
  }

  const dayCounts          = buildDayCounts(data.days, data.selected_session_ids);
  const effectiveActiveDate = activeDayDate || (data.days[0]?.date ?? '');

  function handleDeselect(sessionId: number) {
    const allSessions = data!.days.flatMap((d) =>
      d.time_slots.flatMap((t) => t.sessions),
    );
    const session = allSessions.find((s) => s.session_id === sessionId);
    if (session) toggleSession(sessionId, 'selected');
  }

  // -- Main render --
  return (
    <>
      {/* Sticky page header */}
      <SelectionPageHeader
        workshopTitle={data.workshop.title}
        selectedCount={slotCounts.selected}
        requiredCount={slotCounts.selectable}
        onConfirm={handleDone}
      />

      {/* Sticky day tabs */}
      <nav className="sticky top-28 z-10 bg-white border-b border-gray-100">
        <DayTabBar
          days={data.days}
          activeDate={effectiveActiveDate}
          onDayChange={setActiveDayDate}
          sessionCountsByDay={dayCounts}
        />
      </nav>

      {/* Main content */}
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="flex gap-8 items-start">

            {/* Left: session list */}
            <div className="flex-1 min-w-0 space-y-8">
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

            {/* Right: My Schedule sidebar (desktop only) */}
            <MyScheduleSheet
              selectedSessions={selectedSessions}
              workshopTitle={data.workshop.title}
              onDeselect={handleDeselect}
              onConfirm={handleConfirm}
              isConfirming={isConfirming}
            />

          </div>
        </div>
      </div>

      {/* Mobile FAB — shows selected count, opens bottom sheet */}
      {selectedSessions.length > 0 && (
        <div className="lg:hidden fixed bottom-6 right-6 z-30">
          <button
            type="button"
            onClick={() => setShowMobileSchedule(true)}
            className="flex items-center gap-2 bg-[#0FA3B1] text-white
              font-semibold text-sm px-5 py-3 rounded-full shadow-lg
              hover:bg-[#0c8a96] transition-colors"
          >
            <CalendarDays size={16} />
            {selectedSessions.length} selected
            <ChevronUp size={14} />
          </button>
        </div>
      )}

      {/* Mobile bottom sheet */}
      {showMobileSchedule && (
        <div className="lg:hidden fixed inset-0 z-40 flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowMobileSchedule(false)}
          />
          {/* Sheet */}
          <div className="relative w-full bg-white rounded-t-2xl
            max-h-[60vh] overflow-y-auto">
            {/* Sheet header */}
            <div className="p-4 border-b border-gray-100 flex items-center
              justify-between">
              <h3 className="font-semibold text-gray-900 font-[Sora]">
                My Schedule
              </h3>
              <button
                type="button"
                onClick={() => setShowMobileSchedule(false)}
                aria-label="Close"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Session rows */}
            <div className="divide-y divide-gray-100">
              {selectedSessions.map((session) => (
                <div
                  key={session.session_id}
                  className="flex items-start gap-3 px-5 py-3 group"
                >
                  <div className="w-0.5 bg-[#0FA3B1] rounded-full
                    flex-shrink-0 self-stretch min-h-[36px]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-[#0FA3B1]
                      font-[JetBrains_Mono] uppercase tracking-wide mb-0.5">
                      {session.day_short} · {session.start_display}
                    </p>
                    <p className="text-sm font-medium text-gray-900
                      leading-snug truncate">
                      {session.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeselect(session.session_id)}
                    className="opacity-0 group-hover:opacity-100
                      transition-opacity text-gray-300 hover:text-gray-500
                      flex-shrink-0 mt-0.5"
                    aria-label={`Remove ${session.title}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Confirm button */}
            <div className="p-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => { void handleConfirm(); setShowMobileSchedule(false); }}
                disabled={isConfirming}
                className="w-full py-3 rounded-xl bg-[#0FA3B1] text-white
                  font-semibold text-sm hover:bg-[#0c8a96] transition-colors
                  disabled:opacity-50"
              >
                Confirm Selections
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

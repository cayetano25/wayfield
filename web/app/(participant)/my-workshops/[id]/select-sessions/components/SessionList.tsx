'use client';

import type { SelectableSession, SelectionDay, SessionState } from '@/lib/types/session-selection';
import { ParallelSessionGroup } from './ParallelSessionGroup';
import { SessionCard } from './SessionCard';

interface Props {
  days: SelectionDay[];
  activeDayDate: string;
  onToggle: (sessionId: number, state: SessionState) => void;
  getEffectiveState: (session: SelectableSession) => SessionState;
  pendingSessionIds: Set<number>;
  sessionErrors: Map<number, { message: string }>;
  onClearError: (sessionId: number) => void;
  showAllDays?: boolean;
}

/* -- Time group header ---------------------------------------------------- */

function TimeGroupHeader({ slotTime }: { slotTime: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-xs font-bold text-gray-400 font-[JetBrains_Mono]
        uppercase tracking-wider whitespace-nowrap">
        {slotTime}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

/* -- Day section header (desktop) ---------------------------------------- */

function DayHeader({ dayLabel, dateFormatted }: { dayLabel: string; dateFormatted: string }) {
  return (
    <div
      className="font-heading font-semibold"
      style={{
        fontSize: 14,
        color: '#2E2E2E',
        padding: '12px 0 8px',
        position: 'sticky',
        top: 0,
        backgroundColor: '#F5F5F5',
        zIndex: 10,
      }}
    >
      {dayLabel}, {dateFormatted}
    </div>
  );
}

/* -- SessionList ---------------------------------------------------------- */

export function SessionList({
  days,
  activeDayDate,
  onToggle,
  getEffectiveState,
  pendingSessionIds,
  sessionErrors,
  onClearError,
  showAllDays = false,
}: Props) {
  const visibleDays = showAllDays
    ? days
    : days.filter((d) => d.date === activeDayDate);

  if (visibleDays.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-center"
        style={{ padding: '48px 0' }}
      >
        <p className="font-sans" style={{ fontSize: 14, color: '#9CA3AF' }}>
          No sessions for this day.
        </p>
      </div>
    );
  }

  return (
    <div>
      {visibleDays.map((day) => (
        <div key={day.date}>
          {/* Day header — desktop only */}
          {showAllDays && (
            <DayHeader dayLabel={day.day_label} dateFormatted={day.date_formatted} />
          )}

          {day.time_slots.map((slot, slotIdx) => {
            const isParallel = slot.is_parallel;

            return (
              <div key={`${day.date}-${slotIdx}`}>
                <TimeGroupHeader slotTime={slot.slot_time} />

                {isParallel ? (
                  <ParallelSessionGroup
                    sessions={slot.sessions}
                    onToggle={(sessionId) => {
                      const session = slot.sessions.find((s) => s.session_id === sessionId);
                      if (session) onToggle(sessionId, getEffectiveState(session));
                    }}
                    getEffectiveState={getEffectiveState}
                    pendingSessionIds={pendingSessionIds}
                    sessionErrors={sessionErrors}
                    onClearError={onClearError}
                  />
                ) : slot.sessions[0] ? (
                  <div className="mb-4">
                    <SessionCard
                      session={slot.sessions[0]}
                      effectiveState={getEffectiveState(slot.sessions[0])}
                      isLoading={pendingSessionIds.has(slot.sessions[0].session_id)}
                      errorMessage={
                        sessionErrors.get(slot.sessions[0].session_id)?.message ?? null
                      }
                      onToggle={() => {
                        const s = slot.sessions[0]!;
                        onToggle(s.session_id, getEffectiveState(s));
                      }}
                      onClearError={() => onClearError(slot.sessions[0]!.session_id)}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

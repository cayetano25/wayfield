'use client';

import type { SelectableSession, SessionState } from '@/lib/types/session-selection';
import { SessionCard } from './SessionCard';

interface Props {
  sessions: SelectableSession[];
  onToggle: (sessionId: number) => void;
  getEffectiveState: (session: SelectableSession) => SessionState;
  pendingSessionIds: Set<number>;
  sessionErrors: Map<number, { message: string }>;
  onClearError: (sessionId: number) => void;
}

export function ParallelSessionGroup({
  sessions,
  onToggle,
  getEffectiveState,
  pendingSessionIds,
  sessionErrors,
  onClearError,
}: Props) {
  const hasSelected = sessions.some((s) => getEffectiveState(s) === 'selected');

  return (
    <div>
      {/* "CHOOSE ONE" label */}
      <div
        className="font-sans"
        style={{
          fontSize: 9,
          color: '#9CA3AF',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        Choose one
      </div>

      {/* Mobile: horizontal scroll snap */}
      <div className="md:hidden">
        <div
          className="flex"
          style={{
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            gap: 10,
            paddingRight: 16,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
          } as React.CSSProperties}
        >
          {sessions.map((session) => {
            const state = getEffectiveState(session);
            const err = sessionErrors.get(session.session_id);
            return (
              <div
                key={session.session_id}
                style={{
                  flexShrink: 0,
                  width: '85vw',
                  scrollSnapAlign: 'start',
                }}
              >
                <SessionCard
                  session={session}
                  effectiveState={state}
                  isLoading={pendingSessionIds.has(session.session_id)}
                  errorMessage={err?.message ?? null}
                  onToggle={() => onToggle(session.session_id)}
                  onClearError={() => onClearError(session.session_id)}
                />
              </div>
            );
          })}
        </div>
        <style>{`
          .parallel-scroll::-webkit-scrollbar { display: none; }
        `}</style>
      </div>

      {/* Desktop: flex row */}
      <div className="hidden md:flex" style={{ gap: 12 }}>
        {sessions.map((session) => {
          const state = getEffectiveState(session);
          const err = sessionErrors.get(session.session_id);
          return (
            <div key={session.session_id} className="flex-1 min-w-0">
              <SessionCard
                session={session}
                effectiveState={state}
                isLoading={pendingSessionIds.has(session.session_id)}
                errorMessage={err?.message ?? null}
                onToggle={() => onToggle(session.session_id)}
                onClearError={() => onClearError(session.session_id)}
              />
            </div>
          );
        })}
      </div>

      {/* Note when one is selected */}
      {hasSelected && (
        <p
          className="font-sans italic text-center"
          style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}
        >
          Other options at this time are unavailable
        </p>
      )}
    </div>
  );
}

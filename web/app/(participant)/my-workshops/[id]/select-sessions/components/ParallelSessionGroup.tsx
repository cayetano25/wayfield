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
    <div className="mb-2">
      {/* "CHOOSE ONE" label */}
      <p className="text-[10px] font-bold uppercase tracking-[0.2em]
        text-gray-400 font-[JetBrains_Mono] mb-3">
        Choose One
      </p>

      {/* Responsive grid — 1 col on mobile, 2 col on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sessions.map((session) => {
          const state = getEffectiveState(session);
          const err = sessionErrors.get(session.session_id);
          return (
            <SessionCard
              key={session.session_id}
              session={session}
              effectiveState={state}
              isLoading={pendingSessionIds.has(session.session_id)}
              errorMessage={err?.message ?? null}
              onToggle={() => onToggle(session.session_id)}
              onClearError={() => onClearError(session.session_id)}
            />
          );
        })}
      </div>

      {/* Note when one is selected */}
      {hasSelected && (
        <p className="text-xs text-gray-400 text-center py-2 italic
          font-[Plus_Jakarta_Sans]">
          Other options at this time are unavailable
        </p>
      )}
    </div>
  );
}

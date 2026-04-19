'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deselectSession,
  getSelectionOptions,
  selectSession,
  SessionFullError,
  TimeConflictError,
} from '@/lib/api/sessions';
import type {
  MyScheduleSession,
  SelectableSession,
  SelectionOptionsResponse,
  SessionState,
} from '@/lib/types/session-selection';

interface SessionError {
  type: 'conflict' | 'full';
  message: string;
  conflictWith?: string;
}

function computeStates(
  allSessions: SelectableSession[],
  selectedIds: number[],
): Map<number, SessionState> {
  const selectedSet = new Set(selectedIds);
  const selected = allSessions.filter((s) => selectedSet.has(s.session_id));
  const result = new Map<number, SessionState>();

  for (const session of allSessions) {
    if (selectedSet.has(session.session_id)) {
      result.set(session.session_id, 'selected');
      continue;
    }

    if (session.capacity !== null && session.enrolled_count >= session.capacity) {
      result.set(session.session_id, 'full');
      continue;
    }

    // Overlap: session overlaps with any selected session
    const hasConflict = selected.some(
      (sel) =>
        session.start_at < sel.end_at && session.end_at > sel.start_at,
    );

    result.set(session.session_id, hasConflict ? 'conflicted' : 'available');
  }

  return result;
}

function flattenSessions(data: SelectionOptionsResponse): SelectableSession[] {
  return data.days.flatMap((day) =>
    day.time_slots.flatMap((slot) => slot.sessions),
  );
}

function deriveMySchedule(
  data: SelectionOptionsResponse,
  selectedIds: number[],
): MyScheduleSession[] {
  const selectedSet = new Set(selectedIds);
  const result: MyScheduleSession[] = [];

  for (const day of data.days) {
    for (const slot of day.time_slots) {
      for (const session of slot.sessions) {
        if (!selectedSet.has(session.session_id)) continue;
        result.push({
          session_id: session.session_id,
          title: session.title,
          start_at: session.start_at,
          end_at: session.end_at,
          start_display: session.start_display,
          end_display: session.end_display,
          day_label: day.day_label,
          day_short: day.day_short,
          location_display: session.location_display,
          leaders: session.leaders,
        });
      }
    }
  }

  // Sort chronologically
  result.sort((a, b) => (a.start_at < b.start_at ? -1 : 1));
  return result;
}

export function useSessionSelection(workshopId: number) {
  const [data, setData] = useState<SelectionOptionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Optimistic selected IDs (source of truth for UI)
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [pendingSessionIds, setPendingSessionIds] = useState<Set<number>>(
    new Set(),
  );
  const [sessionErrors, setSessionErrors] = useState<Map<number, SessionError>>(
    new Map(),
  );

  // Keep a stable ref for data so callbacks don't go stale
  const dataRef = useRef<SelectionOptionsResponse | null>(null);
  dataRef.current = data;

  // Load on mount
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getSelectionOptions(workshopId)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setSelectedIds(res.selected_session_ids);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Failed to load session options. Please refresh and try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workshopId]);

  const addPending = (id: number) =>
    setPendingSessionIds((prev) => new Set([...prev, id]));

  const removePending = (id: number) =>
    setPendingSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const toggleSession = useCallback(
    async (sessionId: number, currentState: SessionState) => {
      if (currentState === 'conflicted') {
        const session = flattenSessions(dataRef.current!).find(
          (s) => s.session_id === sessionId,
        );
        const conflictTitle = session?.conflict_with?.title ?? 'another session';
        setSessionErrors((prev) => {
          const next = new Map(prev);
          next.set(sessionId, {
            type: 'conflict',
            message: `Conflicts with "${conflictTitle}"`,
            conflictWith: conflictTitle,
          });
          return next;
        });
        return;
      }

      if (currentState === 'full') {
        return;
      }

      if (currentState === 'selected') {
        // Optimistic deselect
        const prev = selectedIds;
        const next = prev.filter((id) => id !== sessionId);
        setSelectedIds(next);
        addPending(sessionId);

        try {
          await deselectSession(workshopId, sessionId);
          // Sync summary count
          setData((d) => {
            if (!d) return d;
            return {
              ...d,
              selected_session_ids: next,
              selection_summary: {
                ...d.selection_summary,
                total_selected: next.length,
              },
            };
          });
        } catch {
          // Revert
          setSelectedIds(prev);
          setError('Failed to remove session. Please try again.');
        } finally {
          removePending(sessionId);
        }
        return;
      }

      // currentState === 'available'
      const prev = selectedIds;
      const next = [...prev, sessionId];
      setSelectedIds(next);
      addPending(sessionId);

      try {
        await selectSession(workshopId, sessionId);
        setData((d) => {
          if (!d) return d;
          return {
            ...d,
            selected_session_ids: next,
            selection_summary: {
              ...d.selection_summary,
              total_selected: next.length,
            },
          };
        });
      } catch (err) {
        // Revert in all error cases
        setSelectedIds(prev);

        if (err instanceof TimeConflictError) {
          const conflictTitle = err.data.conflict_with.title;
          setSessionErrors((m) => {
            const copy = new Map(m);
            copy.set(sessionId, {
              type: 'conflict',
              message: `Conflicts with "${conflictTitle}"`,
              conflictWith: conflictTitle,
            });
            return copy;
          });
        } else if (err instanceof SessionFullError) {
          // Refresh to get updated counts
          getSelectionOptions(workshopId)
            .then((fresh) => {
              setData(fresh);
              setSelectedIds(fresh.selected_session_ids);
            })
            .catch(() => {});
          setSessionErrors((m) => {
            const copy = new Map(m);
            copy.set(sessionId, {
              type: 'full',
              message: `"${err.data.session_title}" is now full`,
            });
            return copy;
          });
        } else {
          setError('Network error. Please try again.');
        }
      } finally {
        removePending(sessionId);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workshopId, selectedIds],
  );

  const computedStates = data
    ? computeStates(flattenSessions(data), selectedIds)
    : new Map<number, SessionState>();

  function getEffectiveState(session: SelectableSession): SessionState {
    return computedStates.get(session.session_id) ?? session.state;
  }

  const clearSessionError = useCallback((sessionId: number) => {
    setSessionErrors((prev) => {
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const selectedSessions = data ? deriveMySchedule(data, selectedIds) : [];

  return {
    data,
    isLoading,
    error,
    toggleSession,
    getEffectiveState,
    selectedCount: selectedIds.length,
    pendingSessionIds,
    sessionErrors,
    clearSessionError,
    selectedSessions,
  };
}

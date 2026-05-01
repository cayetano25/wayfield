'use client';

import { CalendarPlus, Loader2 } from 'lucide-react';
import type { MyScheduleSession } from '@/lib/types/session-selection';
import { MyScheduleSessionRow } from './MyScheduleSessionRow';

interface Props {
  selectedSessions: MyScheduleSession[];
  workshopTitle: string;
  onDeselect: (sessionId: number) => void;
  onConfirm: () => void;
  isConfirming: boolean;
}

/* -- Helpers -------------------------------------------------------------- */

function summaryLine(sessions: MyScheduleSession[]): string {
  if (sessions.length === 0) return '';
  const days = [...new Set(sessions.map((s) => s.day_short))];
  return `${sessions.length} session${sessions.length !== 1 ? 's' : ''} · ${days.join(' – ')}`;
}

/* -- Empty state ---------------------------------------------------------- */

function EmptySchedule() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: '32px 20px', gap: 12 }}
    >
      <CalendarPlus size={32} style={{ color: '#D1D5DB' }} />
      <p className="font-sans" style={{ fontSize: 13, color: '#9CA3AF' }}>
        Click sessions to build your schedule
      </p>
    </div>
  );
}

/* -- Confirm button ------------------------------------------------------- */

function ConfirmButton({
  count,
  isConfirming,
  onConfirm,
}: {
  count: number;
  isConfirming: boolean;
  onConfirm: () => void;
}) {
  return (
    <button
      type="button"
      onClick={count > 0 ? onConfirm : undefined}
      disabled={isConfirming || count === 0}
      className="w-full font-sans font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
      style={{
        height: 48,
        fontSize: 15,
        backgroundColor: count > 0 ? '#0FA3B1' : '#E5E7EB',
        color: count > 0 ? 'white' : '#9CA3AF',
        cursor: count > 0 && !isConfirming ? 'pointer' : 'default',
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
  );
}

/* -- Desktop: sticky right sidebar ---------------------------------------- */

export function MyScheduleSheet({
  selectedSessions,
  workshopTitle,
  onDeselect,
  onConfirm,
  isConfirming,
}: Props) {
  const count = selectedSessions.length;

  return (
    <div
      className="hidden md:flex flex-col shrink-0"
      style={{
        width: 320,
        borderLeft: '1px solid #E5E7EB',
        backgroundColor: 'white',
        position: 'sticky',
        top: 56,
        height: 'calc(100vh - 56px)',
        overflowY: 'auto',
        alignSelf: 'flex-start',
      }}
    >
      {/* Sidebar header */}
      <div style={{ padding: '20px 20px 12px', flexShrink: 0 }}>
        <p
          className="font-heading font-bold"
          style={{ fontSize: 16, color: '#2E2E2E', marginBottom: 4 }}
        >
          My Schedule
        </p>
        <p className="font-sans" style={{ fontSize: 12, color: '#9CA3AF' }}>
          {workshopTitle}
        </p>
      </div>

      {/* Session list */}
      <div className="flex-1 min-h-0" style={{ padding: '0 20px', overflowY: 'auto' }}>
        {count === 0 ? (
          <EmptySchedule />
        ) : (
          selectedSessions.map((s) => (
            <MyScheduleSessionRow
              key={s.session_id}
              session={s}
              onDeselect={() => onDeselect(s.session_id)}
            />
          ))
        )}
      </div>

      {/* Confirm button — always at bottom of sidebar */}
      <div style={{ padding: 20, flexShrink: 0, borderTop: '1px solid #F3F4F6' }}>
        {summaryLine(selectedSessions) && (
          <p
            className="font-sans"
            style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}
          >
            {summaryLine(selectedSessions)}
          </p>
        )}
        <ConfirmButton count={count} isConfirming={isConfirming} onConfirm={onConfirm} />
      </div>
    </div>
  );
}

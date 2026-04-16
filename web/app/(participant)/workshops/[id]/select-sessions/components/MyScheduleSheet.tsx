'use client';

import { CalendarPlus, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { MyScheduleSession } from '@/lib/types/session-selection';
import { MyScheduleSessionRow } from './MyScheduleSessionRow';

interface Props {
  selectedSessions: MyScheduleSession[];
  workshopTitle: string;
  onDeselect: (sessionId: number) => void;
  onConfirm: () => void;
  isConfirming: boolean;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function summaryLine(sessions: MyScheduleSession[]): string {
  if (sessions.length === 0) return '';
  const days = [...new Set(sessions.map((s) => s.day_short))];
  return `${sessions.length} session${sessions.length !== 1 ? 's' : ''} · ${days.join(' – ')}`;
}

/* ── Empty state ────────────────────────────────────────────────────────── */

function EmptySchedule() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{ padding: '32px 20px', gap: 12 }}
    >
      <CalendarPlus size={32} style={{ color: '#D1D5DB' }} />
      <p className="font-sans" style={{ fontSize: 13, color: '#9CA3AF' }}>
        Tap sessions to build your schedule
      </p>
    </div>
  );
}

/* ── Confirm button ─────────────────────────────────────────────────────── */

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
        `Confirm ${count} Session${count !== 1 ? 's' : ''} →`
      )}
    </button>
  );
}

/* ── Mobile: bottom bar + sheet ─────────────────────────────────────────── */

function MobileSheet({
  selectedSessions,
  workshopTitle,
  onDeselect,
  onConfirm,
  isConfirming,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const count = selectedSessions.length;

  return (
    <>
      {/* Fixed bottom bar */}
      <div
        className="md:hidden"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          backgroundColor: 'white',
          borderTop: '1px solid #E5E7EB',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.08)',
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
        }}
      >
        {/* Left: count badge + label */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-full font-heading font-bold"
            style={{
              width: 32,
              height: 32,
              backgroundColor: count > 0 ? '#0FA3B1' : '#F3F4F6',
              color: count > 0 ? 'white' : '#9CA3AF',
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            {count}
          </div>
          <span className="font-sans" style={{ fontSize: 13, color: '#6B7280' }}>
            sessions selected
          </span>
        </div>

        {/* Right: open sheet button */}
        <button
          type="button"
          onClick={() => count > 0 && setIsOpen(true)}
          className="font-sans font-semibold"
          style={{
            fontSize: 14,
            color: count > 0 ? '#0FA3B1' : '#D1D5DB',
            cursor: count > 0 ? 'pointer' : 'default',
          }}
        >
          View My Schedule ›
        </button>
      </div>

      {/* Sheet overlay */}
      {isOpen && (
        <div
          className="md:hidden"
          style={{ position: 'fixed', inset: 0, zIndex: 50 }}
        >
          {/* Backdrop */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* Sheet panel */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'white',
              borderRadius: '16px 16px 0 0',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              animation: 'sheetSlideUp 300ms ease-out',
            }}
          >
            <style>{`
              @keyframes sheetSlideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
              }
            `}</style>

            {/* Handle + header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #F3F4F6',
                flexShrink: 0,
              }}
            >
              {/* Drag handle */}
              <div
                style={{
                  width: 32,
                  height: 4,
                  backgroundColor: '#E5E7EB',
                  borderRadius: 9999,
                  margin: '0 auto 12px',
                }}
              />
              <p
                className="font-heading font-bold"
                style={{ fontSize: 18, color: '#2E2E2E', marginBottom: 2 }}
              >
                My Schedule
              </p>
              <p className="font-sans" style={{ fontSize: 12, color: '#9CA3AF' }}>
                {workshopTitle}
              </p>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto" style={{ padding: '0 20px', minHeight: 0 }}>
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

            {/* Summary + confirm */}
            {count > 0 && (
              <>
                <div
                  className="font-sans"
                  style={{ fontSize: 12, color: '#6B7280', padding: '12px 20px 0' }}
                >
                  {summaryLine(selectedSessions)}
                </div>
                <div
                  style={{
                    position: 'sticky',
                    bottom: 0,
                    backgroundColor: 'white',
                    padding: 20,
                    paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
                    flexShrink: 0,
                  }}
                >
                  <ConfirmButton
                    count={count}
                    isConfirming={isConfirming}
                    onConfirm={() => { onConfirm(); setIsOpen(false); }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Desktop: right sidebar ─────────────────────────────────────────────── */

function DesktopSidebar({
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
        overflowY: 'auto',
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

      {/* Confirm button at bottom */}
      {count > 0 && (
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
      )}
    </div>
  );
}

/* ── MyScheduleSheet (renders both) ─────────────────────────────────────── */

export function MyScheduleSheet(props: Props) {
  return (
    <>
      <MobileSheet {...props} />
      <DesktopSidebar {...props} />
    </>
  );
}

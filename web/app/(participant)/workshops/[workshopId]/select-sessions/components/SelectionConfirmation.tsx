'use client';

import { useRouter } from 'next/navigation';
import type { MyScheduleSession } from '@/lib/types/session-selection';

interface Props {
  selectedSessions: MyScheduleSession[];
  onBack: () => void;
}

const MAX_SHOW = 6;

export function SelectionConfirmation({ selectedSessions, onBack }: Props) {
  const router = useRouter();
  const visible = selectedSessions.slice(0, MAX_SHOW);
  const overflow = selectedSessions.length - MAX_SHOW;

  return (
    <>
      <style>{`
        @keyframes confirmCircleIn {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes confirmCheckDraw {
          from { stroke-dashoffset: 50; opacity: 0; }
          to   { stroke-dashoffset: 0;  opacity: 1; }
        }
        @keyframes confirmTextFade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Mobile: full-panel inside the bottom sheet area */}
      <div
        className="md:hidden"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'white',
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '48px 24px 32px',
          overflowY: 'auto',
        }}
      >
        <ConfirmationContent
          selectedSessions={selectedSessions}
          visible={visible}
          overflow={overflow}
          onBack={onBack}
          onSchedule={() => router.push('/my-workshops')}
        />
      </div>

      {/* Desktop: modal overlay */}
      <div
        className="hidden md:flex"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          zIndex: 60,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: 16,
            padding: '40px 32px',
            width: '100%',
            maxWidth: 440,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}
        >
          <ConfirmationContent
            selectedSessions={selectedSessions}
            visible={visible}
            overflow={overflow}
            onBack={onBack}
            onSchedule={() => router.push('/my-workshops')}
          />
        </div>
      </div>
    </>
  );
}

/* ── Shared content ─────────────────────────────────────────────────────── */

function ConfirmationContent({
  selectedSessions,
  visible,
  overflow,
  onBack,
  onSchedule,
}: {
  selectedSessions: MyScheduleSession[];
  visible: MyScheduleSession[];
  overflow: number;
  onBack: () => void;
  onSchedule: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center w-full"
      style={{ gap: 0 }}
    >
      {/* Animated circle + checkmark */}
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          backgroundColor: '#0FA3B1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          animation: 'confirmCircleIn 400ms cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline
            points="6 14 11 19 22 9"
            strokeDasharray="50"
            strokeDashoffset="50"
            style={{
              animation: 'confirmCheckDraw 400ms 300ms ease forwards',
            }}
          />
        </svg>
      </div>

      {/* Text */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 24,
          animation: 'confirmTextFade 400ms 500ms ease both',
        }}
      >
        <h2
          className="font-heading font-bold"
          style={{ fontSize: 22, color: '#2E2E2E', marginBottom: 6 }}
        >
          You&apos;re all set!
        </h2>
        <p className="font-sans" style={{ fontSize: 14, color: '#6B7280' }}>
          Your sessions have been saved.
        </p>
      </div>

      {/* Compact schedule summary */}
      {selectedSessions.length > 0 && (
        <div
          className="w-full"
          style={{
            marginBottom: 24,
            animation: 'confirmTextFade 400ms 600ms ease both',
          }}
        >
          {visible.map((s) => (
            <div
              key={s.session_id}
              className="flex items-center"
              style={{ gap: 8, padding: '6px 0', borderBottom: '1px solid #F9FAFB' }}
            >
              <span
                className="font-sans font-bold rounded-full"
                style={{
                  fontSize: 9,
                  padding: '2px 7px',
                  backgroundColor: '#0FA3B1',
                  color: 'white',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  flexShrink: 0,
                }}
              >
                {s.day_short}
              </span>
              <span
                className="font-sans font-medium truncate flex-1"
                style={{ fontSize: 13, color: '#2E2E2E' }}
              >
                {s.title}
              </span>
              <span
                className="font-sans shrink-0"
                style={{ fontSize: 12, color: '#9CA3AF' }}
              >
                {s.start_display}
              </span>
            </div>
          ))}
          {overflow > 0 && (
            <p
              className="font-sans text-center"
              style={{ fontSize: 12, color: '#9CA3AF', paddingTop: 8 }}
            >
              +{overflow} more
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div
        className="w-full flex flex-col"
        style={{ gap: 8, animation: 'confirmTextFade 400ms 700ms ease both' }}
      >
        <button
          type="button"
          onClick={onSchedule}
          className="w-full font-sans font-bold rounded-lg"
          style={{
            height: 48,
            fontSize: 15,
            backgroundColor: '#0FA3B1',
            color: 'white',
          }}
        >
          View My Schedule →
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full font-sans font-semibold rounded-lg"
          style={{
            height: 48,
            fontSize: 15,
            backgroundColor: 'transparent',
            color: '#6B7280',
            border: '1px solid #E5E7EB',
          }}
        >
          Back to Workshop
        </button>
      </div>
    </div>
  );
}

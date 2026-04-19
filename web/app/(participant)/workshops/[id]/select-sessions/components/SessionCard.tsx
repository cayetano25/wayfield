'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Loader2, MapPin, X } from 'lucide-react';
import type { SelectableSession, SessionState } from '@/lib/types/session-selection';
import { LeaderAvatarStack } from './LeaderAvatarStack';

interface Props {
  session: SelectableSession;
  effectiveState: SessionState;
  isLoading: boolean;
  errorMessage: string | null;
  onToggle: () => void;
  onClearError?: () => void;
}

const DELIVERY = {
  in_person: { bg: '#F3F4F6', color: '#6B7280', label: 'IN PERSON' },
  virtual:   { bg: '#EBF5FF', color: '#1D4ED8', label: 'VIRTUAL' },
  hybrid:    { bg: '#F0FDF4', color: '#065F46', label: 'HYBRID' },
} as const;

export function SessionCard({
  session,
  effectiveState,
  isLoading,
  errorMessage,
  onToggle,
  onClearError,
}: Props) {
  const [shaking, setShaking] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-clear error after 4 seconds
  useEffect(() => {
    if (errorMessage && onClearError) {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        onClearError();
      }, 4000);
    }
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [errorMessage, onClearError]);

  function handleClick() {
    if (isLoading) return;
    if (effectiveState === 'conflicted' || effectiveState === 'full') {
      setShaking(true);
      setTimeout(() => setShaking(false), 300);
      return;
    }
    onToggle();
  }

  const isInteractive = effectiveState === 'available' || effectiveState === 'selected';
  const delivery = DELIVERY[session.delivery_type] ?? DELIVERY.in_person;

  const cardBorder =
    effectiveState === 'selected'   ? '2px solid #0FA3B1'
    : effectiveState === 'conflicted' ? '1px solid #FECACA'
    : '1px solid #E5E7EB';

  const cardBg =
    effectiveState === 'selected'   ? '#F0FDFF'
    : effectiveState === 'conflicted' ? '#FFF5F5'
    : 'white';

  const accentBg =
    effectiveState === 'selected'   ? '#0FA3B1'
    : effectiveState === 'conflicted' ? '#E94F37'
    : effectiveState === 'full'       ? '#D1D5DB'
    : null;

  const titleColor =
    effectiveState === 'full' ? '#9CA3AF'
    : effectiveState === 'conflicted' ? '#374151'
    : '#2E2E2E';

  const boxShadow =
    effectiveState === 'selected' ? '0 0 0 3px rgba(15,163,177,0.1)' : undefined;

  // Capacity
  const cap = session.capacity;
  const spotsLeft = session.spots_remaining;
  const isFull = cap !== null && session.enrolled_count >= cap;
  const fillPct = cap ? Math.min((session.enrolled_count / cap) * 100, 100) : 0;
  const barColor = isFull
    ? '#E94F37'
    : spotsLeft !== null && spotsLeft <= 3
      ? '#E67E22'
      : '#0FA3B1';

  const showStrip = effectiveState === 'conflicted' || !!errorMessage;
  const stripMessage =
    errorMessage ??
    (session.conflict_with
      ? `Conflicts with "${session.conflict_with.title}"`
      : 'Time conflict with a selected session');

  return (
    <>
      <style>{`
        @keyframes sessionCardShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
      `}</style>

      <div
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onClick={handleClick}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) handleClick();
        }}
        className="relative overflow-hidden"
        style={{
          border: cardBorder,
          borderRadius: 12,
          backgroundColor: cardBg,
          boxShadow,
          opacity: effectiveState === 'full' ? 0.7 : 1,
          marginBottom: 8,
          cursor: isInteractive ? 'pointer' : 'default',
          padding: '14px 52px 14px 18px',
          transition: 'all 150ms ease',
          animation: shaking ? 'sessionCardShake 300ms ease' : undefined,
        }}
      >
        {/* Left accent bar */}
        {accentBg && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              backgroundColor: accentBg,
              borderRadius: '12px 0 0 12px',
            }}
          />
        )}

        {/* Row 1 — Time + badges */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <span
            className="font-heading font-semibold shrink-0"
            style={{ fontSize: 13, color: '#2E2E2E' }}
          >
            {session.start_display} – {session.end_display}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 9999,
                backgroundColor: delivery.bg,
                color: delivery.color,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {delivery.label}
            </span>
            {effectiveState === 'selected' && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 9999,
                  backgroundColor: '#0FA3B1',
                  color: 'white',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                SELECTED
              </span>
            )}
          </div>
        </div>

        {/* Row 2 — Title */}
        <p
          className="font-sans font-semibold mb-1.5"
          style={{ fontSize: 15, color: titleColor, lineHeight: 1.3 }}
        >
          {session.title}
        </p>

        {/* Row 3 — Leaders + location */}
        <div
          className="flex items-center overflow-hidden"
          style={{ gap: 6, minHeight: 20 }}
        >
          {session.leaders.length > 0 && (
            <>
              <LeaderAvatarStack leaders={session.leaders} />
              <span
                className="font-sans truncate"
                style={{ fontSize: 12, color: '#6B7280', flexShrink: 1 }}
              >
                {session.leaders.map((l) => l.first_name).join(' · ')}
              </span>
            </>
          )}
          {session.location_display && (
            <>
              {session.leaders.length > 0 && (
                <span style={{ fontSize: 12, color: '#D1D5DB', flexShrink: 0 }}>·</span>
              )}
              <MapPin
                size={10}
                style={{ color: '#9CA3AF', flexShrink: 0 }}
              />
              <span
                className="font-sans truncate"
                style={{ fontSize: 12, color: '#9CA3AF' }}
              >
                {session.location_display}
              </span>
            </>
          )}
        </div>

        {/* Row 4 — Capacity bar */}
        {cap !== null && (
          <div style={{ marginTop: 10 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
              <span className="font-sans" style={{ fontSize: 10, color: '#9CA3AF' }}>
                {session.enrolled_count} of {cap} spots
              </span>
              <span
                className="font-sans font-medium"
                style={{
                  fontSize: 10,
                  color: isFull ? '#E94F37' : (spotsLeft !== null && spotsLeft <= 3 ? '#E67E22' : '#9CA3AF'),
                }}
              >
                {isFull ? 'Full' : spotsLeft !== null ? `${spotsLeft} left` : ''}
              </span>
            </div>
            <div style={{ height: 3, backgroundColor: '#F3F4F6', borderRadius: 9999 }}>
              <div
                style={{
                  height: '100%',
                  width: `${fillPct}%`,
                  backgroundColor: barColor,
                  borderRadius: 9999,
                  transition: 'width 300ms ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Toggle button */}
        <div
          style={{
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            ...(effectiveState === 'available'
              ? { border: '2px solid #D1D5DB', backgroundColor: 'white' }
              : effectiveState === 'selected'
                ? { backgroundColor: '#0FA3B1' }
                : { backgroundColor: '#F3F4F6', cursor: 'not-allowed' }),
          }}
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin" style={{ color: '#9CA3AF' }} />
          ) : effectiveState === 'selected' ? (
            <Check size={16} style={{ color: 'white' }} />
          ) : effectiveState === 'conflicted' ? (
            <X size={14} style={{ color: '#E94F37' }} />
          ) : effectiveState === 'full' ? (
            <X size={14} style={{ color: '#D1D5DB' }} />
          ) : null}
        </div>

        {/* Conflict / error strip */}
        {showStrip && (
          <div
            style={{
              margin: '10px -52px -14px -18px',
              padding: '8px 14px',
              borderTop: '1px solid #FECACA',
              backgroundColor: '#FFF5F5',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AlertCircle size={12} style={{ color: '#E94F37', flexShrink: 0 }} />
            <span
              className="font-sans"
              style={{
                fontSize: 11,
                color: errorMessage ? '#E67E22' : '#E94F37',
              }}
            >
              {stripMessage}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

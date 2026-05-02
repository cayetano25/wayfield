'use client';

import { useEffect, useRef } from 'react';
import { AlertCircle, Check, Clock, Loader2, MapPin } from 'lucide-react';
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

function formatDeliveryType(dt: SelectableSession['delivery_type']): string {
  switch (dt) {
    case 'in_person': return 'In Person';
    case 'virtual':   return 'Virtual';
    case 'hybrid':    return 'Hybrid';
  }
}

export function SessionCard({
  session,
  effectiveState,
  isLoading,
  errorMessage,
  onToggle,
  onClearError,
}: Props) {
  const isSelected    = effectiveState === 'selected';
  const isConflicted  = effectiveState === 'conflicted';
  const isUnavailable = effectiveState === 'full';
  const isDisabled    = isConflicted || isUnavailable;

  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (errorMessage && onClearError) {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => onClearError(), 4000);
    }
    return () => { if (clearTimerRef.current) clearTimeout(clearTimerRef.current); };
  }, [errorMessage, onClearError]);

  function handleClick() {
    if (isLoading || isDisabled) return;
    onToggle();
  }

  const cap      = session.capacity;
  const spotsLeft = session.spots_remaining;
  const isFull   = cap !== null && session.enrolled_count >= cap;
  const fillPct  = cap ? Math.min((session.enrolled_count / cap) * 100, 100) : 0;

  const conflictLabel =
    errorMessage ??
    (session.conflict_with ? `Conflicts with "${session.conflict_with.title}"` : null);

  return (
    <div
      role={!isDisabled ? 'button' : undefined}
      tabIndex={!isDisabled ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) handleClick(); }}
      className={`relative rounded-2xl overflow-hidden bg-white transition-all duration-200
        ${isSelected
          ? 'border-2 border-[#0FA3B1] shadow-[0_4px_16px_rgba(15,163,177,0.2)]'
          : isDisabled
            ? 'border border-gray-200 opacity-50 cursor-not-allowed'
            : 'border border-gray-200 hover:border-[#0FA3B1]/50 hover:shadow-md cursor-pointer'
        }`}
      style={{ marginBottom: 8 }}
    >
      {/* ── ZONE 1: Photo header ──────────────────────────────────────── */}
      <div className="relative h-40 overflow-hidden">

        {/* Teal gradient (no image field on session) */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #0FA3B1 0%, #1a3a4a 60%, #111827 100%)' }}
        />

        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />

        {/* SELECTED badge — top right */}
        {isSelected && !isLoading && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full
              bg-[#0FA3B1] text-white text-[10px] font-bold uppercase tracking-wide
              font-[JetBrains_Mono]">
              <Check size={10} />
              Selected
            </span>
          </div>
        )}

        {/* Loading spinner — top right */}
        {isLoading && (
          <div className="absolute top-3 right-3">
            <Loader2 size={16} className="animate-spin text-white/70" />
          </div>
        )}

        {/* Delivery type badge — top left */}
        <div className="absolute top-3 left-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em]
            text-white/70 font-[JetBrains_Mono] bg-black/30 rounded-full px-2 py-1">
            {formatDeliveryType(session.delivery_type)}
          </span>
        </div>

        {/* Title overlay — bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.15em]
            text-white/60 font-[JetBrains_Mono] mb-1">
            Session
          </p>
          <h3 className="text-white font-bold font-[Sora] text-lg leading-snug line-clamp-2">
            {session.title}
          </h3>
        </div>
      </div>

      {/* ── ZONE 2: Time + location row ───────────────────────────────── */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-1.5 text-[#0FA3B1] text-sm font-medium">
          <Clock size={13} />
          <span>{session.start_display} – {session.end_display}</span>
        </div>
        {session.location_display && (
          <>
            <span className="text-gray-300">·</span>
            <div className="flex items-center gap-1.5 text-gray-500 text-sm min-w-0">
              <MapPin size={13} className="flex-shrink-0" />
              <span className="truncate max-w-[140px]">{session.location_display}</span>
            </div>
          </>
        )}
      </div>

      {/* ── ZONE 3: Description ───────────────────────────────────────── */}
      {session.description && (
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
            {session.description}
          </p>
        </div>
      )}

      {/* ── ZONE 4: Leaders + capacity ────────────────────────────────── */}
      <div className="px-4 py-3">
        {session.leaders.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <LeaderAvatarStack leaders={session.leaders} />
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em]
                text-gray-400 font-[JetBrains_Mono]">
                {session.leaders.length === 1 ? 'Session Leader' : 'Session Leaders'}
              </p>
              <p className="text-xs font-semibold text-gray-900">
                {session.leaders
                  .map((l) => `${l.first_name} ${l.last_name.charAt(0)}.`)
                  .join(' & ')}
              </p>
            </div>
          </div>
        )}

        {cap !== null && (
          <>
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{session.enrolled_count} of {cap} spots</span>
              <span className={`font-medium ${
                isFull
                  ? 'text-[#E94F37]'
                  : spotsLeft !== null && spotsLeft <= 3
                    ? 'text-[#E67E22]'
                    : 'text-gray-400'
              }`}>
                {isFull ? 'Full' : spotsLeft !== null ? `${spotsLeft} left` : ''}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1">
              <div
                className="bg-[#0FA3B1] h-1 rounded-full transition-all"
                style={{ width: `${fillPct}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Conflict / unavailable strip ──────────────────────────────── */}
      {(isConflicted || isUnavailable || !!errorMessage) && (
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100
          flex items-center gap-1.5">
          <AlertCircle size={12} className="text-gray-400 flex-shrink-0" />
          <span className="text-[11px] text-gray-400">
            {conflictLabel ?? 'Not available'}
          </span>
        </div>
      )}
    </div>
  );
}

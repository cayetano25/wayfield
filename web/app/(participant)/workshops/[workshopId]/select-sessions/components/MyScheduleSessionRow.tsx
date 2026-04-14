'use client';

import { X } from 'lucide-react';
import type { MyScheduleSession } from '@/lib/types/session-selection';

interface Props {
  session: MyScheduleSession;
  onDeselect: () => void;
}

export function MyScheduleSessionRow({ session, onDeselect }: Props) {
  return (
    <div
      className="flex items-center"
      style={{
        padding: '12px 0',
        borderBottom: '1px solid #F9FAFB',
        gap: 12,
      }}
    >
      {/* Left teal timeline bar */}
      <div
        style={{
          width: 3,
          alignSelf: 'stretch',
          minHeight: 40,
          backgroundColor: '#0FA3B1',
          borderRadius: 9999,
          flexShrink: 0,
        }}
      />

      {/* Center content */}
      <div className="flex-1 min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          className="font-sans font-semibold uppercase"
          style={{ fontSize: 11, color: '#0FA3B1', letterSpacing: '0.04em' }}
        >
          {session.day_short} · {session.start_display}
        </span>
        <span
          className="font-sans font-semibold truncate"
          style={{ fontSize: 13, color: '#2E2E2E' }}
        >
          {session.title}
        </span>
        {session.location_display && (
          <span
            className="font-sans truncate"
            style={{ fontSize: 11, color: '#9CA3AF' }}
          >
            {session.location_display}
          </span>
        )}
      </div>

      {/* Deselect button */}
      <button
        type="button"
        onClick={onDeselect}
        className="flex items-center justify-center rounded-full transition-colors group shrink-0"
        aria-label={`Remove ${session.title}`}
        style={{
          width: 24,
          height: 24,
          border: '1.5px solid #D1D5DB',
          backgroundColor: 'white',
          color: '#D1D5DB',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#E94F37';
          (e.currentTarget as HTMLButtonElement).style.color = '#E94F37';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = '#D1D5DB';
          (e.currentTarget as HTMLButtonElement).style.color = '#D1D5DB';
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import type { PublicSession } from '@/lib/api/public';

function formatSessionTime(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const dateStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const startTime = start.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const endTime = end.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  return `${dateStr} · ${startTime} – ${endTime}`;
}

interface ScheduleItemProps {
  session: PublicSession;
  dayLabel?: string;
}

export function ScheduleItem({ session, dayLabel }: ScheduleItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden">
      {/* Clickable header row */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-4 py-4 px-2 text-left
          hover:bg-gray-50 transition-colors rounded-lg"
        aria-expanded={expanded}
      >
        {/* Day label (left fixed column) */}
        {dayLabel && (
          <span className="font-mono text-[10px] font-bold text-gray-400
            uppercase tracking-widest w-12 flex-shrink-0 pt-0.5">
            {dayLabel}
          </span>
        )}

        {/* Content (center) */}
        <div className="flex-1 min-w-0">
          {/* Track label */}
          {session.track_name && (
            <p className="font-mono text-[10px] font-semibold text-gray-400
              uppercase tracking-wider mb-1">
              {session.track_name}
            </p>
          )}

          {/* Session title */}
          <p className="font-semibold text-gray-900 text-sm leading-snug">
            {session.title}
          </p>

          {/* Time */}
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
            <Clock size={11} />
            {formatSessionTime(session.start_at, session.end_at)}
          </p>

          {/* Delivery + add-on badges */}
          <div className="flex items-center gap-2 mt-1">
            {session.delivery_type !== 'in_person' && (
              <span className="font-mono text-[10px] font-semibold text-[#0FA3B1]
                uppercase tracking-wide">
                {session.delivery_type === 'virtual' ? '📡 Virtual' : '🔀 Hybrid'}
              </span>
            )}
            {session.is_addon && (
              <span className="font-mono text-[10px] font-semibold text-[#E67E22]
                uppercase tracking-wide">
                Add-On
              </span>
            )}
          </div>
        </div>

        {/* Expand chevron */}
        <ChevronDown
          size={16}
          className={`text-gray-400 flex-shrink-0 mt-0.5 transition-transform
            ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expandable description */}
      {expanded && session.description_preview && (
        <div className={`pb-4 border-t border-gray-100 ${dayLabel ? 'pl-16 pr-2' : 'px-2'}`}>
          <p className="text-sm text-gray-500 italic mt-3 leading-relaxed">
            {session.description_preview}
          </p>
          {session.description_preview.endsWith('...') && (
            <p className="text-xs text-gray-400 mt-2">
              Full details available after registration.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

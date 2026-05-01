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

  const [dayWord, dayNum] = dayLabel ? dayLabel.split(' ') : [null, null];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

      {/* Clickable header row */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-stretch text-left hover:bg-gray-50/60 transition-colors"
        aria-expanded={expanded}
      >
        {/* DAY sidebar — teal accent column */}
        {dayLabel && (
          <div className="flex flex-col items-center justify-center gap-0.5
            bg-[#0FA3B1]/8 border-r border-[#0FA3B1]/15
            px-3 py-4 min-w-[3.5rem] flex-shrink-0">
            <span className="font-mono text-[8px] font-bold text-[#0FA3B1]
              uppercase tracking-widest leading-none">
              {dayWord}
            </span>
            <span className="font-mono text-sm font-bold text-[#0FA3B1] leading-none">
              {dayNum}
            </span>
          </div>
        )}

        {/* Session content */}
        <div className="flex-1 min-w-0 px-4 py-3">
          {session.track_name && (
            <p className="font-mono text-[10px] font-semibold text-gray-400
              uppercase tracking-wider mb-1">
              {session.track_name}
            </p>
          )}
          <p className="font-semibold text-gray-900 text-sm leading-snug">
            {session.title}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
            <Clock size={11} />
            {formatSessionTime(session.start_at, session.end_at)}
          </p>
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

        {/* Chevron */}
        <div className="flex items-center pr-4 pl-2">
          <ChevronDown
            size={16}
            className={`text-gray-400 flex-shrink-0 transition-transform
              ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Expandable description */}
      {expanded && session.description_preview && (
        <div className={`pb-4 border-t border-gray-100
          ${dayLabel ? 'pl-[3.5rem] pr-4' : 'px-4'}`}>
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

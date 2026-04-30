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

export function ScheduleItem({ session }: { session: PublicSession }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden transition-all hover:border-gray-300">
      {/* Clickable header row */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start justify-between gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          {/* Track label */}
          {session.track_name && (
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 font-[JetBrains_Mono]">
              {session.track_name}
            </p>
          )}

          {/* Session title */}
          <p className="font-semibold text-gray-900 text-sm leading-snug">{session.title}</p>

          {/* Time */}
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
            <Clock size={11} />
            {formatSessionTime(session.start_at, session.end_at)}
          </p>

          {/* Delivery type badge */}
          {session.delivery_type !== 'in_person' && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-[#0FA3B1] uppercase tracking-wide font-[JetBrains_Mono]">
              {session.delivery_type === 'virtual' ? '📡 Virtual' : '🔀 Hybrid'}
            </span>
          )}

          {/* Add-on badge */}
          {session.is_addon && (
            <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-[#E67E22] uppercase tracking-wide font-[JetBrains_Mono] ${session.delivery_type !== 'in_person' ? 'ml-2' : ''}`}>
              Add-On
            </span>
          )}
        </div>

        {/* Expand chevron */}
        <ChevronDown
          size={16}
          className={`text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expandable description preview */}
      {expanded && session.description_preview && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <p className="text-sm text-gray-600 mt-3 leading-relaxed">
            {session.description_preview}
          </p>
          {session.description_preview.endsWith('...') && (
            <p className="text-xs text-gray-400 mt-2 italic">
              Full details available after registration.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

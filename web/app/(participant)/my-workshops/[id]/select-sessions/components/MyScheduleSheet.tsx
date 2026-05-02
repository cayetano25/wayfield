'use client';

import { X } from 'lucide-react';
import type { MyScheduleSession } from '@/lib/types/session-selection';

interface Props {
  selectedSessions: MyScheduleSession[];
  workshopTitle: string;
  onDeselect: (sessionId: number) => void;
  onConfirm: () => void;
  isConfirming: boolean;
}

export function MyScheduleSheet({
  selectedSessions,
  workshopTitle,
  onDeselect,
  onConfirm,
  isConfirming,
}: Props) {
  return (
    <aside className="hidden lg:block w-72 flex-shrink-0">
      <div className="sticky top-20">
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">

          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em]
              text-gray-400 font-[JetBrains_Mono] mb-0.5">
              My Schedule
            </p>
            <p className="text-sm font-semibold text-gray-900 font-[Sora]">
              {workshopTitle}
            </p>
          </div>

          {/* Selected session list */}
          <div className="divide-y divide-gray-100">
            {selectedSessions.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-xs text-gray-400">
                  No sessions selected yet.
                </p>
              </div>
            ) : (
              selectedSessions.map((session) => (
                <div
                  key={session.session_id}
                  className="flex items-start gap-3 px-5 py-3
                    hover:bg-gray-50 transition-colors group"
                >
                  {/* Teal left bar */}
                  <div className="w-0.5 bg-[#0FA3B1] rounded-full
                    flex-shrink-0 self-stretch min-h-[36px]" />

                  <div className="flex-1 min-w-0">
                    {/* Day + time */}
                    <p className="text-[10px] font-bold text-[#0FA3B1]
                      font-[JetBrains_Mono] uppercase tracking-wide mb-0.5">
                      {session.day_short} · {session.start_display}
                    </p>
                    {/* Session title */}
                    <p className="text-sm font-medium text-gray-900
                      leading-snug truncate">
                      {session.title}
                    </p>
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => onDeselect(session.session_id)}
                    className="opacity-0 group-hover:opacity-100
                      transition-opacity text-gray-300 hover:text-gray-500
                      flex-shrink-0 mt-0.5"
                    aria-label={`Remove ${session.title}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Confirm button — lg:hidden since desktop header already has one */}
          {selectedSessions.length > 0 && (
            <div className="p-4 border-t border-gray-100 lg:hidden">
              <button
                type="button"
                onClick={onConfirm}
                disabled={isConfirming}
                className="w-full py-3 rounded-xl bg-[#0FA3B1] text-white
                  font-semibold text-sm hover:bg-[#0c8a96] transition-colors
                  disabled:opacity-50"
              >
                {isConfirming ? 'Saving…' : 'Confirm Selections'}
              </button>
            </div>
          )}

        </div>
      </div>
    </aside>
  );
}

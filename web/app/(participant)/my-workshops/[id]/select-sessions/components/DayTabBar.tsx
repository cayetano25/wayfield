'use client';

import type { SelectionDay } from '@/lib/types/session-selection';

interface Props {
  days: SelectionDay[];
  activeDate: string;
  onDayChange: (date: string) => void;
  sessionCountsByDay: Record<string, { total: number; selected: number }>;
  className?: string;
}

export function DayTabBar({
  days,
  activeDate,
  onDayChange,
  sessionCountsByDay,
}: Props) {
  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
        <div className="flex items-center gap-2 flex-wrap">
          {days.map((day) => {
            const isActive = day.date === activeDate;
            const counts = sessionCountsByDay[day.date] ?? { total: 0, selected: 0 };
            const dateNum = day.date.split('-')[2] ?? '';

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => onDayChange(day.date)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm
                  font-semibold transition-all
                  ${isActive
                    ? 'bg-[#0FA3B1] text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
              >
                <span className="font-[JetBrains_Mono] text-xs font-bold uppercase tracking-wider opacity-70">
                  {day.day_short}
                </span>
                <span className="text-base font-bold font-[Sora]">
                  {dateNum}
                </span>
                {counts.selected > 0 && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isActive ? 'bg-white' : 'bg-[#0FA3B1]'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

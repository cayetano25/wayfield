'use client';

import { useRef } from 'react';
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
  className = '',
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function handleClick(date: string) {
    onDayChange(date);
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-date="${date}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  return (
    <div
      className={`bg-white shrink-0 ${className}`}
      style={{ borderBottom: '1px solid #E5E7EB' }}
    >
      <div
        ref={scrollRef}
        className="flex items-stretch"
        style={{
          height: 48,
          paddingLeft: 16,
          paddingRight: 16,
          gap: 4,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
        } as React.CSSProperties}
      >
        {days.map((day) => {
          const isActive = day.date === activeDate;
          const counts = sessionCountsByDay[day.date] ?? { total: 0, selected: 0 };
          const dateNumber = day.date.split('-')[2] ?? '';

          return (
            <button
              key={day.date}
              data-date={day.date}
              type="button"
              onClick={() => handleClick(day.date)}
              className="flex flex-col items-center justify-center shrink-0"
              style={{
                minWidth: 64,
                padding: '0 12px',
                borderBottom: isActive ? '2px solid #0FA3B1' : '2px solid transparent',
                color: isActive ? '#0FA3B1' : '#9CA3AF',
                gap: 2,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em',
                  fontFamily: 'var(--font-sans, "Plus Jakarta Sans", sans-serif)',
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                {day.day_short}
              </span>
              <span
                className="font-heading font-bold"
                style={{ fontSize: 18, lineHeight: 1 }}
              >
                {dateNumber}
              </span>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: counts.selected > 0 ? '#0FA3B1' : 'transparent',
                  display: 'block',
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Hide webkit scrollbar */}
      <style>{`
        .daytabbar-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

'use client';

import { useState, useEffect, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { generateTimeSlots } from '@/lib/datetime/timezoneUtils';

interface SessionTimePickerProps {
  value: string | null;
  onChange: (time: string) => void;
  hourCycle: '12' | '24';
  label: string;
  minTime?: string;
  disabled?: boolean;
  error?: string;
  required?: boolean;
  id?: string;
  intervalMinutes?: 15 | 30;
  onHourCycleChange?: (cycle: '12' | '24') => void;
}

export function SessionTimePicker({
  value,
  onChange,
  hourCycle,
  label,
  minTime,
  disabled = false,
  error,
  required = false,
  id,
  intervalMinutes = 15,
  onHourCycleChange,
}: SessionTimePickerProps) {
  // Tracks the display format. Initialises from prop, user toggle overrides it.
  const [displayCycle, setDisplayCycle] = useState<'12' | '24'>(hourCycle);

  // Sync when the parent resets the hour cycle (e.g. timezone change).
  useEffect(() => {
    setDisplayCycle(hourCycle);
  }, [hourCycle]);

  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = error ? `${selectId}-error` : undefined;

  const slots = generateTimeSlots(intervalMinutes, displayCycle);

  function handleToggle() {
    const next: '12' | '24' = displayCycle === '12' ? '24' : '12';
    setDisplayCycle(next);
    onHourCycleChange?.(next);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={selectId} className="text-sm font-medium text-dark">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className="text-xs text-primary hover:underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {displayCycle === '12' ? 'Switch to 24h' : 'Switch to 12h'}
        </button>
      </div>

      <div className="relative">
        <select
          id={selectId}
          value={value ?? ''}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
          disabled={disabled}
          required={required}
          aria-describedby={errorId}
          aria-invalid={error ? true : undefined}
          className={[
            'w-full h-10 pl-3 pr-10 text-sm text-dark bg-white',
            'border rounded-lg outline-none appearance-none transition-colors',
            'focus:ring-2 focus:ring-primary/20 focus:border-primary',
            'disabled:bg-surface disabled:text-medium-gray disabled:cursor-not-allowed',
            error
              ? 'border-danger focus:border-danger focus:ring-danger/20'
              : 'border-border-gray',
          ].join(' ')}
        >
          {!value && (
            <option value="" disabled>
              Select a time
            </option>
          )}
          {slots.map((slot) => (
            <option
              key={slot.value}
              value={slot.value}
              disabled={minTime ? slot.value < minTime : false}
            >
              {slot.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-medium-gray pointer-events-none" />
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

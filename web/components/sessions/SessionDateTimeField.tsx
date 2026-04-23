'use client';

import { useState, useEffect, useRef } from 'react';
import { SessionDatePicker } from './SessionDatePicker';
import { SessionTimePicker } from './SessionTimePicker';
import {
  UTCToLocal,
  localToUTC,
  detectHourCycle,
} from '@/lib/datetime/timezoneUtils';

interface SessionDateTimeFieldProps {
  label: string;
  dateLabel?: string;
  timeLabel?: string;
  value: string | null;
  onChange: (utcISO: string | null) => void;
  ianaTimezone: string;
  minDate?: string;
  maxDate?: string;
  /** Applied only when the selected date equals minDate */
  minTime?: string;
  disabled?: boolean;
  dateError?: string;
  timeError?: string;
  required?: boolean;
}

export function SessionDateTimeField({
  label,
  dateLabel,
  timeLabel,
  value,
  onChange,
  ianaTimezone,
  minDate,
  maxDate,
  minTime,
  disabled = false,
  dateError,
  timeError,
  required = false,
}: SessionDateTimeFieldProps) {
  const [localDate, setLocalDate] = useState<string | null>(null);
  const [localTime, setLocalTime] = useState<string | null>(null);
  const [hourCycle, setHourCycle] = useState<'12' | '24'>('12');

  // Keep a stable ref to onChange so the emit effect doesn't need it as a dep.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Detect hour cycle from timezone (runs when timezone changes).
  useEffect(() => {
    setHourCycle(detectHourCycle(ianaTimezone));
  }, [ianaTimezone]);

  // Decompose the incoming UTC value into local date and time.
  useEffect(() => {
    if (value) {
      try {
        const { date, time } = UTCToLocal(value, ianaTimezone);
        setLocalDate(date);
        setLocalTime(time);
      } catch {
        setLocalDate(null);
        setLocalTime(null);
      }
    } else {
      setLocalDate(null);
      setLocalTime(null);
    }
  }, [value, ianaTimezone]);

  // Emit a UTC ISO string whenever the local date or time changes.
  useEffect(() => {
    if (localDate && localTime) {
      try {
        onChangeRef.current(localToUTC(localDate, localTime, ianaTimezone));
      } catch {
        onChangeRef.current(null);
      }
    } else {
      onChangeRef.current(null);
    }
  }, [localDate, localTime, ianaTimezone]);

  const resolvedDateLabel = dateLabel ?? `${label} Date`;
  const resolvedTimeLabel = timeLabel ?? `${label} Time`;

  // minTime is only relevant when the selected date is the boundary date.
  const effectiveMinTime = localDate === minDate ? minTime : undefined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SessionDatePicker
        label={resolvedDateLabel}
        value={localDate}
        onChange={setLocalDate}
        minDate={minDate}
        maxDate={maxDate}
        disabled={disabled}
        error={dateError}
        required={required}
      />
      <SessionTimePicker
        label={resolvedTimeLabel}
        value={localTime}
        onChange={setLocalTime}
        hourCycle={hourCycle}
        onHourCycleChange={setHourCycle}
        minTime={effectiveMinTime}
        disabled={disabled}
        error={timeError}
        required={required}
      />
    </div>
  );
}

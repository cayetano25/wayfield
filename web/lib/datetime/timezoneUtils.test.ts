import { describe, it, expect } from 'vitest';
import {
  detectHourCycle,
  localToUTC,
  UTCToLocal,
  generateTimeSlots,
} from './timezoneUtils';

describe('detectHourCycle', () => {
  const cases: [string, '12' | '24'][] = [
    ['America/Chicago', '12'],
    ['America/New_York', '12'],
    ['America/Los_Angeles', '12'],
    ['Europe/Berlin', '24'],
    ['Europe/London', '12'],  // en-GB uses h12
    ['Europe/Paris', '24'],
    ['Asia/Tokyo', '24'],
    ['Asia/Kolkata', '12'],   // city override → en-IN
    ['Asia/Manila', '12'],    // city override → en-PH
    ['Asia/Shanghai', '24'],
    ['Australia/Sydney', '12'],
    ['Pacific/Auckland', '12'], // city override → en-NZ
    ['', '12'],               // graceful fallback
    ['Invalid/Timezone', '12'], // graceful fallback
  ];

  it.each(cases)('detectHourCycle(%s) → %s', (timezone, expected) => {
    expect(detectHourCycle(timezone)).toBe(expected);
  });
});

describe('localToUTC', () => {
  it('converts standard CDT offset (UTC-5)', () => {
    expect(localToUTC('2026-09-15', '14:00', 'America/Chicago')).toBe(
      '2026-09-15T19:00:00.000Z'
    );
  });

  it('converts standard CST offset (UTC-6)', () => {
    expect(localToUTC('2026-01-15', '14:00', 'America/Chicago')).toBe(
      '2026-01-15T20:00:00.000Z'
    );
  });

  it('converts half-hour offset IST (UTC+5:30)', () => {
    expect(localToUTC('2026-06-01', '09:00', 'Asia/Kolkata')).toBe(
      '2026-06-01T03:30:00.000Z'
    );
  });

  it('handles midnight boundary (EDT = UTC-4)', () => {
    expect(localToUTC('2026-09-15', '00:30', 'America/New_York')).toBe(
      '2026-09-15T04:30:00.000Z'
    );
  });

  it('handles 24-hour rollover (JST = UTC+9)', () => {
    expect(localToUTC('2026-09-15', '23:45', 'Asia/Tokyo')).toBe(
      '2026-09-15T14:45:00.000Z'
    );
  });
});

describe('UTCToLocal', () => {
  it('converts UTC to CDT local time', () => {
    expect(UTCToLocal('2026-09-15T19:00:00.000Z', 'America/Chicago')).toEqual({
      date: '2026-09-15',
      time: '14:00',
    });
  });

  it('converts UTC to CST local time', () => {
    expect(UTCToLocal('2026-01-15T20:00:00.000Z', 'America/Chicago')).toEqual({
      date: '2026-01-15',
      time: '14:00',
    });
  });
});

describe('generateTimeSlots', () => {
  it('returns 96 items for 15-minute intervals', () => {
    expect(generateTimeSlots(15, '12')).toHaveLength(96);
  });

  it('returns 48 items for 30-minute intervals', () => {
    expect(generateTimeSlots(30, '24')).toHaveLength(48);
  });

  it('first slot is 12:00 AM in 12-hour mode', () => {
    const slots = generateTimeSlots(15, '12');
    expect(slots[0]).toEqual({ value: '00:00', label: '12:00 AM' });
  });

  it('first slot is 00:00 in 24-hour mode', () => {
    const slots = generateTimeSlots(15, '24');
    expect(slots[0]).toEqual({ value: '00:00', label: '00:00' });
  });

  it('index 48 (12:00) is 12:00 PM in 12-hour mode', () => {
    const slots = generateTimeSlots(15, '12');
    expect(slots[48]).toEqual({ value: '12:00', label: '12:00 PM' });
  });

  it('index 52 (13:00) is 1:00 PM in 12-hour mode', () => {
    const slots = generateTimeSlots(15, '12');
    expect(slots[52]).toEqual({ value: '13:00', label: '1:00 PM' });
  });

  it('last slot (23:45) is 11:45 PM in 12-hour mode', () => {
    const slots = generateTimeSlots(15, '12');
    expect(slots[95]).toEqual({ value: '23:45', label: '11:45 PM' });
  });
});

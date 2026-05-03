'use client';

import type { IconProps } from './types';

export default function ParticipantIcon({
  size = 24,
  color = '#334155',
  accent = '#0FA3B1',
  className,
  'aria-label': ariaLabel,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      role={ariaLabel ? 'img' : undefined}
    >
      {/* Head — slightly left of center to leave room for badge */}
      <circle cx="10" cy="7" r="3.5" stroke={color} strokeWidth={2} />

      {/* Shoulders / body arc */}
      <path
        d="M 2.5 20.5 C 2.5 15 6 12 10 12 C 14 12 17.5 15 17.5 20.5"
        stroke={color}
        strokeWidth={2}
        fill="none"
      />

      {/* Badge — filled teal circle, bottom-right */}
      <circle cx="18" cy="18" r="4" fill={accent} stroke="none" />

      {/* Checkmark inside badge — white stroke */}
      <path
        d="M 15.8 18 L 17.5 19.8 L 20.5 16.5"
        stroke="#FFFFFF"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

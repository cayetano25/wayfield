'use client';

import type { IconProps } from './types';

export default function ParticipantIcon({
  size = 24,
  color = '#2E2E2E',
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
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      role={ariaLabel ? 'img' : undefined}
    >
      {/* Head */}
      <circle cx={12} cy={7} r={3.5} />
      {/* Shoulder curve */}
      <path d="M 4 20 C 4 15 8 12 12 12 C 16 12 20 15 20 20" />
      {/* Badge backing circle — filled with accent, no stroke */}
      <circle cx={18} cy={18} r={4} fill={accent} stroke="none" />
      {/* Checkmark inside badge */}
      <path
        d="M 15.5 18 L 17.2 19.7 L 20.5 16.5"
        stroke="#FFFFFF"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

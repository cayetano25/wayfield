'use client';

import type { IconProps } from './types';

export default function OfflineReadyIcon({
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
      {/* Phone body */}
      <rect x="6" y="2" width="12" height="20" rx="2.5" stroke={color} strokeWidth={2} fill="none" />

      {/* Speaker notch at top */}
      <line x1="9.5" y1="5" x2="14.5" y2="5" stroke={color} strokeWidth={1.5} />

      {/* Home button indicator at bottom */}
      <circle cx="12" cy="19" r="1" fill={color} stroke="none" />

      {/* Circle-slash: outer circle in teal, centered on phone screen */}
      <circle cx="12" cy="12" r="3.5" stroke={accent} strokeWidth={1.5} fill="none" />

      {/* Diagonal slash — top-right to bottom-left */}
      <line x1="14.5" y1="9.5" x2="9.5" y2="14.5" stroke={accent} strokeWidth={1.5} />
    </svg>
  );
}

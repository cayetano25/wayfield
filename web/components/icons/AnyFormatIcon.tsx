'use client';

import type { IconProps } from './types';

export default function AnyFormatIcon({
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
      {/* Globe outer circle */}
      <circle cx="11" cy="12" r="7.5" stroke={color} strokeWidth={2} />

      {/* Equator */}
      <line x1="3.5" y1="12" x2="18.5" y2="12" stroke={color} strokeWidth={1.5} />

      {/* Upper latitude arc */}
      <path d="M 4.5 8.5 Q 11 7 17.5 8.5" stroke={color} strokeWidth={1.5} fill="none" />

      {/* Lower latitude arc */}
      <path d="M 4.5 15.5 Q 11 17 17.5 15.5" stroke={color} strokeWidth={1.5} fill="none" />

      {/* Longitude oval through center */}
      <path
        d="M 11 4.5 C 8.5 7 8.5 17 11 19.5 C 13.5 17 13.5 7 11 4.5"
        stroke={color} strokeWidth={1.5} fill="none"
      />

      {/* Dashed teal outer arc — upper-right quadrant */}
      <path
        d="M 11 2 A 10 10 0 0 1 21 12"
        stroke={accent} strokeWidth={1.5} strokeDasharray="2.5 2" fill="none"
      />

      {/* Connector line to signal node */}
      <line x1="19.5" y1="5" x2="21" y2="3.5" stroke={accent} strokeWidth={1.5} />

      {/* Small solid teal dot — broadcast node */}
      <circle cx="21.5" cy="3" r="1.5" fill={accent} stroke="none" />
    </svg>
  );
}

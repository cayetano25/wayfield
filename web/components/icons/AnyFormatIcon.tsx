'use client';

import type { IconProps } from './types';

export default function AnyFormatIcon({
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
      {/* Outer globe circle */}
      <circle cx={12} cy={12} r={9.5} />
      {/* Center longitude oval */}
      <path d="M 12 2.5 C 9 6 9 18 12 21.5 C 15 18 15 6 12 2.5" />
      {/* Top latitude arc — accent */}
      <path d="M 3 8.5 Q 12 6.5 21 8.5" stroke={accent} />
      {/* Middle latitude line */}
      <line x1={2.5} y1={12} x2={21.5} y2={12} />
      {/* Bottom latitude arc — accent */}
      <path d="M 3 15.5 Q 12 17.5 21 15.5" stroke={accent} />
    </svg>
  );
}

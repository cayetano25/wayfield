'use client';

import type { IconProps } from './types';

export default function OfflineReadyIcon({
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
      {/* Phone body */}
      <rect x={6} y={1} width={12} height={21} rx={2.5} />
      {/* Home button notch */}
      <rect x={9.5} y={18.5} width={5} height={2} rx={1} />
      {/* Speaker notch at top */}
      <line x1={10} y1={4} x2={14} y2={4} />
      {/* Download arrow — accent colored */}
      <line x1={12} y1={8} x2={12} y2={15} stroke={accent} />
      <polyline points="9,12.5 12,15.5 15,12.5" stroke={accent} />
    </svg>
  );
}

'use client';

import type { IconProps } from './types';

export default function OrganizerIcon({
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
      {/* Outer rounded rectangle */}
      <rect x={2} y={2} width={20} height={20} rx={3} />
      {/* Top-left cell */}
      <rect x={5} y={5} width={6} height={6} rx={1.5} />
      {/* Top-right cell — accent highlighted */}
      <rect
        x={13}
        y={5}
        width={6}
        height={6}
        rx={1.5}
        fill={accent}
        fillOpacity={0.2}
        stroke={accent}
      />
      {/* Bottom-left cell */}
      <rect x={5} y={13} width={6} height={6} rx={1.5} />
      {/* Bottom-right cell */}
      <rect x={13} y={13} width={6} height={6} rx={1.5} />
    </svg>
  );
}

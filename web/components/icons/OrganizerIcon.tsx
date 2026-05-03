'use client';

import type { IconProps } from './types';

export default function OrganizerIcon({
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
      {/* Building body */}
      <rect x="3" y="5" width="18" height="17" rx="1.5" stroke={color} strokeWidth={2} fill="none" />

      {/* Ground line */}
      <line x1="1" y1="22" x2="23" y2="22" stroke={color} strokeWidth={2} />

      {/* Window — top-left, teal accent fill */}
      <rect
        x="6" y="9" width="4" height="3.5" rx="0.5"
        fill={accent} fillOpacity="0.25"
        stroke={accent} strokeWidth={1.5}
      />

      {/* Window — top-right, stroke only */}
      <rect
        x="14" y="9" width="4" height="3.5" rx="0.5"
        stroke={color} strokeWidth={1.5} fill="none"
      />

      {/* Window — bottom-left, stroke only */}
      <rect
        x="6" y="14.5" width="4" height="3.5" rx="0.5"
        stroke={color} strokeWidth={1.5} fill="none"
      />

      {/* Window — bottom-right, teal accent fill */}
      <rect
        x="14" y="14.5" width="4" height="3.5" rx="0.5"
        fill={accent} fillOpacity="0.25"
        stroke={accent} strokeWidth={1.5}
      />

      {/* Door — centered at bottom of building */}
      <rect
        x="9.5" y="18" width="5" height="4" rx="0.5"
        stroke={color} strokeWidth={1.5} fill="none"
      />
    </svg>
  );
}

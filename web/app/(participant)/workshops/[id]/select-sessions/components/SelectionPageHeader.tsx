'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { SelectionOptionsResponse } from '@/lib/types/session-selection';

interface Props {
  workshop: SelectionOptionsResponse['workshop'];
  selectedCount: number;
  totalSelectable: number;
  onDone: () => void;
}

export function SelectionPageHeader({
  workshop,
  selectedCount,
  totalSelectable,
  onDone,
}: Props) {
  const router = useRouter();
  const titleDisplay =
    workshop.title.length > 28 ? `${workshop.title.slice(0, 28)}…` : workshop.title;

  return (
    <div
      className="bg-white z-50 shrink-0"
      style={{ borderBottom: '1px solid #E5E7EB' }}
    >
      {/* ── Mobile: two-row header ─────────────────────────────────── */}
      <div className="md:hidden">
        {/* Row 1 */}
        <div
          className="flex items-center justify-between px-4"
          style={{ height: 48 }}
        >
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center"
            aria-label="Go back"
            style={{ color: '#6B7280' }}
          >
            <ChevronLeft size={20} />
          </button>
          <span
            className="font-heading font-semibold"
            style={{ fontSize: 15, color: '#2E2E2E' }}
          >
            Select Sessions
          </span>
          <button
            type="button"
            onClick={selectedCount > 0 ? onDone : undefined}
            className="font-sans font-bold"
            style={{
              fontSize: 14,
              color: selectedCount > 0 ? '#0FA3B1' : '#D1D5DB',
              cursor: selectedCount > 0 ? 'pointer' : 'default',
              minWidth: 40,
              textAlign: 'right',
            }}
          >
            DONE
          </button>
        </div>

        {/* Row 2 — context bar */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '8px 16px',
            backgroundColor: '#F0FDFF',
            borderBottom: '2px solid #0FA3B1',
          }}
        >
          <span
            className="font-sans font-semibold truncate"
            style={{ fontSize: 13, color: '#0FA3B1', maxWidth: '60%' }}
          >
            {titleDisplay}
          </span>
          <span
            className="font-heading font-bold shrink-0"
            style={{ fontSize: 13, color: '#2E2E2E' }}
          >
            {selectedCount} / {totalSelectable} selected
          </span>
        </div>
      </div>

      {/* ── Desktop: single-row header ──────────────────────────────── */}
      <div
        className="hidden md:flex items-center justify-between px-6"
        style={{ height: 56 }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Go back"
            style={{ width: 32, height: 32, color: '#6B7280' }}
          >
            <ChevronLeft size={20} />
          </button>
          <span
            className="font-heading font-semibold truncate"
            style={{ fontSize: 15, color: '#2E2E2E', maxWidth: 240 }}
          >
            {workshop.title}
          </span>
          <span style={{ color: '#D1D5DB', flexShrink: 0 }}>·</span>
          <span
            className="font-sans shrink-0"
            style={{ fontSize: 13, color: '#6B7280' }}
          >
            Select Sessions
          </span>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <span
            className="font-sans"
            style={{ fontSize: 13, color: '#6B7280' }}
          >
            {selectedCount} of {totalSelectable}
          </span>
          <button
            type="button"
            onClick={selectedCount > 0 ? onDone : undefined}
            className="font-sans font-bold rounded-lg px-5 transition-colors"
            style={{
              height: 40,
              fontSize: 14,
              backgroundColor: selectedCount > 0 ? '#0FA3B1' : '#E5E7EB',
              color: selectedCount > 0 ? 'white' : '#9CA3AF',
              cursor: selectedCount > 0 ? 'pointer' : 'default',
            }}
          >
            Confirm Selections
          </button>
        </div>
      </div>
    </div>
  );
}

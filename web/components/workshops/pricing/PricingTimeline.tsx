'use client';

import { Users } from 'lucide-react';
import { formatCents } from '@/lib/utils/currency';
import type { PriceTier } from '@/lib/api/priceTiers';

const TIER_COLORS = [
  '#0FA3B1',
  '#7EA8BE',
  '#E67E22',
  '#9B59B6',
  '#27AE60',
];

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Segment {
  label: string;
  priceCents: number | null;
  widthPct: number;
  color: string;
  capacityLimit?: number | null;
  isTier: boolean;
}

function buildDateSegments(
  tiers: PriceTier[],
  workshopStartDate: string,
  basePriceCents: number,
): { segments: Segment[]; boundaryDates: string[] } {
  const today = Date.now();
  const workshopEnd = new Date(workshopStartDate + 'T23:59:59').getTime();
  const totalMs = workshopEnd - today;
  if (totalMs <= 0) return { segments: [], boundaryDates: [] };

  const sorted = [...tiers]
    .filter((t) => t.valid_from !== null || t.valid_until !== null)
    .sort((a, b) => {
      const aEnd = a.valid_until ? new Date(a.valid_until).getTime() : Infinity;
      const bEnd = b.valid_until ? new Date(b.valid_until).getTime() : Infinity;
      return aEnd - bEnd;
    });

  const segments: Segment[] = [];
  const boundaryDates: string[] = [];
  let cursor = today;
  let tierColorIdx = 0;

  for (const tier of sorted) {
    const segStart = tier.valid_from
      ? Math.max(new Date(tier.valid_from).getTime(), today)
      : cursor;
    const segEnd = tier.valid_until
      ? Math.min(new Date(tier.valid_until).getTime(), workshopEnd)
      : workshopEnd;

    if (segStart > cursor && segStart <= workshopEnd) {
      const gapMs = Math.min(segStart, workshopEnd) - cursor;
      if (gapMs > 0) {
        segments.push({
          label: 'Base Price',
          priceCents: basePriceCents,
          widthPct: (gapMs / totalMs) * 100,
          color: '#E5E7EB',
          isTier: false,
        });
      }
    }

    const tierMs = Math.max(0, Math.min(segEnd, workshopEnd) - Math.max(segStart, today));
    if (tierMs > 0) {
      segments.push({
        label: tier.label,
        priceCents: tier.price_cents,
        widthPct: (tierMs / totalMs) * 100,
        color: TIER_COLORS[tierColorIdx % TIER_COLORS.length],
        capacityLimit: tier.capacity_limit,
        isTier: true,
      });
      tierColorIdx++;
      if (tier.valid_until && new Date(tier.valid_until).getTime() < workshopEnd) {
        boundaryDates.push(tier.valid_until);
      }
    }

    cursor = Math.max(cursor, segEnd);
  }

  if (cursor < workshopEnd) {
    const remainMs = workshopEnd - cursor;
    segments.push({
      label: 'Base Price',
      priceCents: basePriceCents,
      widthPct: (remainMs / totalMs) * 100,
      color: '#E5E7EB',
      isTier: false,
    });
  }

  return { segments, boundaryDates };
}

function buildCapacitySegments(
  tiers: PriceTier[],
  basePriceCents: number,
): Segment[] {
  const sorted = [...tiers].sort((a, b) => a.sort_order - b.sort_order);
  const knownCapacity = sorted.reduce((s, t) => s + (t.capacity_limit ?? 0), 0);
  const displayTotal = knownCapacity > 0 ? knownCapacity * 1.25 : 100;

  const segments: Segment[] = [];
  let colorIdx = 0;
  for (const tier of sorted) {
    const cap = tier.capacity_limit ?? 0;
    segments.push({
      label: tier.label,
      priceCents: tier.price_cents,
      widthPct: (cap / displayTotal) * 100,
      color: TIER_COLORS[colorIdx % TIER_COLORS.length],
      capacityLimit: tier.capacity_limit,
      isTier: true,
    });
    colorIdx++;
  }
  const remainPct = Math.max(0, 100 - segments.reduce((s, seg) => s + seg.widthPct, 0));
  if (remainPct > 0) {
    segments.push({
      label: 'Base Price',
      priceCents: basePriceCents,
      widthPct: remainPct,
      color: '#E5E7EB',
      isTier: false,
    });
  }
  return segments;
}

interface PricingTimelineProps {
  tiers: PriceTier[];
  workshopStartDate?: string;
  basePriceCents: number;
}

export function PricingTimeline({ tiers, workshopStartDate, basePriceCents }: PricingTimelineProps) {
  if (tiers.length === 0) return null;

  const allCapacityBased = tiers.every(
    (t) => t.capacity_limit !== null && t.valid_from === null && t.valid_until === null,
  );

  if (allCapacityBased) {
    const segments = buildCapacitySegments(tiers, basePriceCents);
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 mb-4 overflow-x-auto">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 font-[JetBrains_Mono]">
          Pricing Timeline
        </p>
        <div className="relative h-10 flex rounded-lg overflow-hidden min-w-[400px]">
          {segments.map((seg, i) => (
            <div
              key={i}
              style={{ width: `${seg.widthPct}%`, backgroundColor: seg.color }}
              className="flex flex-col items-start justify-center px-2 overflow-hidden shrink-0"
            >
              <span className="text-[10px] font-semibold text-white truncate w-full leading-tight">
                {seg.label}
              </span>
              <div className="flex items-center gap-1">
                {seg.capacityLimit !== null && seg.capacityLimit !== undefined && (
                  <Users size={9} className="text-white/80 shrink-0" />
                )}
                <span className="text-[10px] text-white/90 truncate">
                  {seg.capacityLimit !== null && seg.capacityLimit !== undefined
                    ? `${seg.capacityLimit} seats`
                    : 'Remaining'}
                  {seg.priceCents !== null ? ` · ${formatCents(seg.priceCents)}` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-[JetBrains_Mono] min-w-[400px]">
          <span>First seat</span>
          <span>Remaining seats</span>
        </div>
      </div>
    );
  }

  if (!workshopStartDate) return null;

  const { segments, boundaryDates } = buildDateSegments(tiers, workshopStartDate, basePriceCents);
  if (segments.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 mb-4 overflow-x-auto">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 font-[JetBrains_Mono]">
        Pricing Timeline
      </p>
      <div className="relative h-10 flex rounded-lg overflow-hidden min-w-[400px]">
        {segments.map((seg, i) => (
          <div
            key={i}
            style={{ width: `${seg.widthPct}%`, backgroundColor: seg.color }}
            className="flex flex-col items-start justify-center px-2 overflow-hidden shrink-0"
          >
            <span
              className="text-[10px] font-semibold truncate w-full leading-tight"
              style={{ color: seg.isTier ? '#fff' : '#6B7280' }}
            >
              {seg.label}
            </span>
            <div className="flex items-center gap-1">
              {seg.capacityLimit != null && (
                <Users size={9} className={seg.isTier ? 'text-white/80' : 'text-gray-400'} />
              )}
              {seg.priceCents !== null && (
                <span
                  className="text-[10px] truncate"
                  style={{ color: seg.isTier ? 'rgba(255,255,255,0.9)' : '#9CA3AF' }}
                >
                  {formatCents(seg.priceCents)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-[JetBrains_Mono] min-w-[400px]">
        <span>Today</span>
        {boundaryDates.map((d) => (
          <span key={d}>{formatShortDate(d)}</span>
        ))}
        <span>Workshop starts</span>
      </div>
    </div>
  );
}

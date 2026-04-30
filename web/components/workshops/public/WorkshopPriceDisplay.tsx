import { Users, Clock } from 'lucide-react';
import type { WorkshopPricingDisplay } from '@/lib/api/public';

function formatCents(cents: number): string {
  return `$${(Math.round(cents) / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

interface WorkshopPriceDisplayProps {
  pricing: WorkshopPricingDisplay;
}

export function WorkshopPriceDisplay({ pricing }: WorkshopPriceDisplayProps) {
  if (pricing.current_price_cents === 0 && !pricing.is_tier_price) return null;

  const remaining = pricing.remaining_at_current_price;
  const nextChange = pricing.next_price_change;

  const remainingColor =
    remaining !== null && remaining <= 3
      ? '#E94F37'
      : remaining !== null && remaining <= 10
        ? '#E67E22'
        : '#4B5563';

  const alertStyle: React.CSSProperties =
    nextChange?.urgency === 'urgent'
      ? { background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B' }
      : nextChange?.urgency === 'soon'
        ? { background: '#FFFBEB', border: '1px solid #FDE68A', color: '#78350F' }
        : { background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#374151' };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      {/* Current price */}
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-3xl font-bold text-gray-900">
          {pricing.current_price_cents === 0 ? 'Free' : formatCents(pricing.current_price_cents)}
        </span>
        {pricing.show_original_price && pricing.base_price_cents > 0 && (
          <span className="text-xl text-gray-400 line-through">
            {formatCents(pricing.base_price_cents)}
          </span>
        )}
      </div>

      {/* Tier label */}
      {pricing.is_tier_price && pricing.current_tier_label && (
        <span className="inline-flex items-center rounded-full bg-teal-100 text-teal-800
          border border-teal-200 px-2.5 py-0.5 text-xs font-semibold mb-3">
          {pricing.current_tier_label}
        </span>
      )}

      {/* Remaining capacity at this price */}
      {remaining !== null && (
        <p
          className="text-sm font-medium mb-3 flex items-center gap-1.5"
          style={{ color: remainingColor }}
        >
          <Users size={14} />
          {remaining === 0
            ? 'This price tier is full'
            : `${remaining} spot${remaining !== 1 ? 's' : ''} at this price`}
        </p>
      )}

      {/* Next price change alert */}
      {nextChange && (
        <div
          className="rounded-xl p-3 text-sm flex items-start gap-2 mb-3"
          style={alertStyle}
        >
          <Clock size={14} className="flex-shrink-0 mt-0.5" />
          <span>
            {nextChange.change_direction === 'increase' ? 'Price increases' : 'Price changes'} to{' '}
            {formatCents(nextChange.price_cents)}
            {nextChange.changes_at
              ? ` on ${formatDate(nextChange.changes_at)}`
              : nextChange.changes_at_capacity
                ? ` after ${nextChange.changes_at_capacity} more registration${nextChange.changes_at_capacity !== 1 ? 's' : ''}`
                : ''}
          </span>
        </div>
      )}

      {pricing.current_price_cents > 0 && (
        <p className="text-xs text-gray-400 mt-1">Registration fee per person</p>
      )}
    </div>
  );
}

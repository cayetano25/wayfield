import { Clock } from 'lucide-react'
import type { PublicWorkshop } from '@/lib/api/public'
import { AddToCartButton } from './AddToCartButton'

function formatCents(cents: number): string {
  return `$${(Math.round(cents) / 100).toFixed(2)}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function RegistrationCard({ workshop }: { workshop: PublicWorkshop }) {
  const pricing = workshop.pricing
  const org = workshop.organization

  // registration_count, capacity, spots_remaining not available on PublicWorkshop —
  // omitted. Add if the API surface is extended.

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
      }}
    >
      <div className="p-5">

        {/* Label */}
        <p className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase
          text-[#0FA3B1] mb-4">
          Registration
        </p>

        {/* Price */}
        {pricing && (
          <div className="mb-4">
            <div className="flex items-baseline gap-2.5">
              <span className="font-heading text-white font-bold text-2xl">
                {pricing.current_price_cents === 0
                  ? 'Free'
                  : formatCents(pricing.current_price_cents)}
              </span>
              {pricing.show_original_price && pricing.base_price_cents > 0 && (
                <span className="text-white/50 text-sm line-through">
                  {formatCents(pricing.base_price_cents)}
                </span>
              )}
            </div>
            {pricing.current_tier_label && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full
                bg-[#0FA3B1]/20 text-[#0FA3B1] text-xs font-medium mt-1.5">
                {pricing.current_tier_label}
              </span>
            )}
          </div>
        )}

        {/* Spots remaining at current price tier */}
        {pricing?.remaining_at_current_price != null && (
          <p className="text-[#0FA3B1] text-xs font-medium mb-3">
            {pricing.remaining_at_current_price === 0
              ? 'This price tier is full'
              : `${pricing.remaining_at_current_price} spot${pricing.remaining_at_current_price !== 1 ? 's' : ''} at this price`}
          </p>
        )}

        {/* Next price change notice */}
        {pricing?.next_price_change && (
          <div
            className="rounded-xl p-3 mb-4 text-xs flex items-start gap-1.5"
            style={{ background: 'rgba(255, 255, 255, 0.08)' }}
          >
            <Clock size={12} className="text-white/60 flex-shrink-0 mt-0.5" />
            <span className="text-white/70 leading-relaxed">
              Price {pricing.next_price_change.change_direction === 'increase' ? 'increases' : 'changes'}{' '}
              to {formatCents(pricing.next_price_change.price_cents)}
              {pricing.next_price_change.changes_at
                ? ` on ${formatDate(pricing.next_price_change.changes_at)}`
                : pricing.next_price_change.changes_at_capacity
                  ? ` after ${pricing.next_price_change.changes_at_capacity} more registration${pricing.next_price_change.changes_at_capacity !== 1 ? 's' : ''}`
                  : ''}
            </span>
          </div>
        )}

        {/* Register / Cart button — exact same props as the page's pricing section */}
        {org && (
          <AddToCartButton
            workshopId={workshop.id}
            orgId={org.id}
            orgSlug={org.slug}
            publicSlug={workshop.public_slug}
            pricing={pricing}
            fullWidth
          />
        )}

        {/* Per-person note */}
        {pricing && pricing.current_price_cents > 0 && (
          <p className="text-white/40 text-[11px] text-center mt-2">
            Registration fee per person
          </p>
        )}

      </div>
    </div>
  )
}

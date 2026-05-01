import { Calendar, MapPin, Users, Clock } from 'lucide-react'
import type { PublicWorkshop } from '@/lib/api/public'
import { AddToCartButton } from './AddToCartButton'

function formatCents(cents: number): string {
  return `$${(Math.round(cents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function formatDateRange(start: string, end: string, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: timezone,
  }
  const s = new Date(`${start}T00:00:00`).toLocaleDateString('en-US', opts)
  const e = new Date(`${end}T00:00:00`).toLocaleDateString('en-US', opts)
  return s === e ? s : `${s} – ${e}`
}

function formatChangeDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function PricingDetailsCard({ workshop }: { workshop: PublicWorkshop }) {
  const pricing = workshop.pricing
  const org = workshop.organization

  const locationLine = [
    workshop.default_location?.city,
    workshop.default_location?.state_or_region,
  ].filter(Boolean).join(', ')

  const isFree = !pricing || pricing.current_price_cents === 0
  const priceDisplay = isFree ? 'Free' : formatCents(pricing!.current_price_cents)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">

      {/* Label */}
      <p className="font-mono text-[10px] font-bold tracking-[0.15em] uppercase
        text-gray-400 mb-1">
        Total Investment
      </p>

      {/* Price */}
      <div className="flex items-baseline gap-2.5 mb-5">
        <span className="font-heading text-4xl font-bold text-gray-900">
          {priceDisplay}
        </span>
        {pricing?.show_original_price && pricing.base_price_cents > 0 && (
          <span className="text-xl text-gray-400 line-through">
            {formatCents(pricing.base_price_cents)}
          </span>
        )}
      </div>

      {/* Tier badge */}
      {pricing?.current_tier_label && (
        <div className="mb-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full
            bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold">
            {pricing.current_tier_label}
          </span>
        </div>
      )}

      {/* Details list */}
      <div className="space-y-3 mb-5">
        <div className="flex items-start gap-3">
          <Calendar size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-900 font-medium">
              {formatDateRange(workshop.start_date, workshop.end_date, workshop.timezone)}
            </p>
            <p className="text-xs text-gray-400">Date of instruction</p>
          </div>
        </div>

        {locationLine && (
          <div className="flex items-start gap-3">
            <MapPin size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-900 font-medium">{locationLine}</p>
              <p className="text-xs text-gray-400">General location</p>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <Users size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-900 font-medium">
              {workshop.workshop_type === 'session_based' ? 'Session-Based' : 'Event-Based'}
            </p>
            <p className="text-xs text-gray-400">Workshop format</p>
          </div>
        </div>
      </div>

      {/* Spots at current price */}
      {pricing?.remaining_at_current_price != null && (
        <p className="text-[#0FA3B1] text-xs font-medium mb-3">
          {pricing.remaining_at_current_price === 0
            ? 'This price tier is full'
            : `${pricing.remaining_at_current_price} spot${pricing.remaining_at_current_price !== 1 ? 's' : ''} at this price`}
        </p>
      )}

      {/* Next price change notice */}
      {pricing?.next_price_change && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 mb-4
          text-xs flex items-start gap-2">
          <Clock size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <span className="text-amber-700 leading-relaxed">
            Price {pricing.next_price_change.change_direction === 'increase'
              ? 'increases' : 'changes'}{' '}
            to {formatCents(pricing.next_price_change.price_cents)}
            {pricing.next_price_change.changes_at
              ? ` on ${formatChangeDate(pricing.next_price_change.changes_at)}`
              : pricing.next_price_change.changes_at_capacity
                ? ` after ${pricing.next_price_change.changes_at_capacity} more registration${pricing.next_price_change.changes_at_capacity !== 1 ? 's' : ''}`
                : ''}
          </span>
        </div>
      )}

      {/* Register / Cart button — exact same props as the original page pricing section */}
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

      {!isFree && (
        <p className="text-xs text-gray-400 text-center mt-2">
          Registration fee per person
        </p>
      )}
    </div>
  )
}

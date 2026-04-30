'use client';

import { useState } from 'react';
import { formatCents, calcFees, PLAN_LABEL } from '@/lib/utils/currency';
import type { PriceTier } from '@/lib/api/priceTiers';

interface RevenueCalculatorProps {
  basePriceCents: number;
  takeRate: number;
  planCode: string;
  tiers?: PriceTier[];
}

export function RevenueCalculator({ basePriceCents, takeRate, planCode, tiers = [] }: RevenueCalculatorProps) {
  const [expectedAttendees, setExpectedAttendees] = useState(20);

  const takeRatePct = takeRate / 100;
  const { stripeFeeCents, wayfieldFeeCents, payoutCents } = calcFees(basePriceCents, takeRatePct);
  const planName = PLAN_LABEL[planCode] ?? planCode;

  const activeTiers = tiers.filter((t) => t.is_active);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-gray-700">Estimated Payout</p>
        <span className="text-xs text-gray-400 font-[JetBrains_Mono]">{planName} plan</span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Registration price</span>
          <span className="font-medium">{formatCents(basePriceCents)}</span>
        </div>
        <div className="flex justify-between text-red-500">
          <span>Stripe fee (2.9% + $0.30)</span>
          <span>— {formatCents(stripeFeeCents)}</span>
        </div>
        <div className="flex justify-between text-red-500">
          <span>Wayfield fee ({takeRate.toFixed(1)}%)</span>
          <span>— {formatCents(wayfieldFeeCents)}</span>
        </div>
        <div className="flex justify-between pt-3 border-t border-gray-200 font-semibold">
          <span className="text-gray-900">Your payout (est.)</span>
          <span className="text-[#0FA3B1] text-base">{formatCents(payoutCents)}</span>
        </div>
      </div>

      {/* Expected revenue multiplier */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500 whitespace-nowrap">Expected attendees</label>
          <input
            type="range"
            min="1"
            max="200"
            value={expectedAttendees}
            onChange={(e) => setExpectedAttendees(Number(e.target.value))}
            className="flex-1 accent-[#0FA3B1]"
          />
          <span className="text-xs font-semibold text-gray-700 w-8 text-right">
            {expectedAttendees}
          </span>
        </div>
        <p className="text-sm font-semibold text-gray-900 mt-2">
          Estimated net revenue:{' '}
          <span className="text-[#0FA3B1] ml-2">
            {formatCents(payoutCents * expectedAttendees)}
          </span>
        </p>
      </div>

      {/* Tier breakdown */}
      {activeTiers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 font-[JetBrains_Mono]">
            Tier Revenue Estimate
          </p>
          <div className="space-y-0">
            {activeTiers.map((tier) => {
              const estimatedRegistrations = tier.capacity_limit
                ? tier.capacity_limit
                : Math.round(expectedAttendees / activeTiers.length);
              const { payoutCents: tierPayout } = calcFees(tier.price_cents, takeRatePct);
              const tierNet = tierPayout * estimatedRegistrations;

              return (
                <div
                  key={tier.id}
                  className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{tier.label}</p>
                    <p className="text-xs text-gray-500">
                      {tier.capacity_limit
                        ? `~${estimatedRegistrations} at ${formatCents(tier.price_cents)}`
                        : `${formatCents(tier.price_cents)}${tier.valid_until ? ` until ${new Date(tier.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-[#0FA3B1] ml-4 shrink-0">
                    ~{formatCents(tierNet)}
                  </span>
                </div>
              );
            })}
            {/* Base price remainder */}
            {(() => {
              const tierSeats = activeTiers
                .filter((t) => t.capacity_limit !== null)
                .reduce((s, t) => s + (t.capacity_limit ?? 0), 0);
              const remainingAttendees = Math.max(0, expectedAttendees - tierSeats);
              if (remainingAttendees === 0 && tierSeats > 0) return null;
              const baseNet = payoutCents * remainingAttendees;
              return (
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Base Price</p>
                    <p className="text-xs text-gray-500">
                      ~{remainingAttendees} at {formatCents(basePriceCents)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-[#0FA3B1] ml-4">
                    ~{formatCents(baseNet)}
                  </span>
                </div>
              );
            })()}
          </div>
          <p className="text-xs font-semibold text-gray-900 mt-3 pt-3 border-t border-gray-200">
            Total estimated net:{' '}
            <span className="text-[#0FA3B1]">
              ~{formatCents(
                activeTiers.reduce((sum, tier) => {
                  const est = tier.capacity_limit
                    ? tier.capacity_limit
                    : Math.round(expectedAttendees / activeTiers.length);
                  const { payoutCents: tp } = calcFees(tier.price_cents, takeRatePct);
                  return sum + tp * est;
                }, 0) +
                  (() => {
                    const tierSeats = activeTiers
                      .filter((t) => t.capacity_limit !== null)
                      .reduce((s, t) => s + (t.capacity_limit ?? 0), 0);
                    const rem = Math.max(0, expectedAttendees - tierSeats);
                    return payoutCents * rem;
                  })(),
              )}
            </span>
          </p>
        </div>
      )}

      <p className="text-[10px] text-gray-400 mt-3 font-[JetBrains_Mono]">
        ESTIMATES ONLY · ACTUAL AMOUNTS MAY VARY DUE TO REFUNDS AND CHARGEBACKS
      </p>
    </div>
  );
}

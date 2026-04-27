'use client';

import { useState } from 'react';
import { formatCents, calcFees, PLAN_LABEL } from '@/lib/utils/currency';

interface RevenueCalculatorProps {
  basePriceCents: number;
  takeRate: number;   // percentage, e.g. 2.0 for 2%
  planCode: string;
}

export function RevenueCalculator({ basePriceCents, takeRate, planCode }: RevenueCalculatorProps) {
  const [expectedAttendees, setExpectedAttendees] = useState(20);

  const takeRatePct = takeRate / 100;
  const { stripeFeeCents, wayfieldFeeCents, payoutCents } = calcFees(basePriceCents, takeRatePct);
  const planName = PLAN_LABEL[planCode] ?? planCode;

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

      <p className="text-[10px] text-gray-400 mt-3 font-[JetBrains_Mono]">
        ESTIMATES ONLY · ACTUAL AMOUNTS MAY VARY DUE TO REFUNDS AND CHARGEBACKS
      </p>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { Toggle } from '@/components/ui/Toggle';
import { formatCents, calcFees } from '@/lib/utils/currency';

interface DepositConfigProps {
  available: boolean;          // false → show upgrade prompt
  enabled: boolean;
  onToggle: (v: boolean) => void;
  depositAmountCents: number;
  onDepositAmountChange: (cents: number) => void;
  basePriceCents: number;
  balanceDueDate: string;
  onBalanceDueDateChange: (d: string) => void;
  workshopStartDate?: string;
  balanceAutoCharge: boolean;
  onBalanceAutoChargeChange: (v: boolean) => void;
  takeRate: number;   // percentage
  depositAmountError?: string | null;
}

export function DepositConfig({
  available,
  enabled,
  onToggle,
  depositAmountCents,
  onDepositAmountChange,
  basePriceCents,
  balanceDueDate,
  onBalanceDueDateChange,
  workshopStartDate,
  balanceAutoCharge,
  onBalanceAutoChargeChange,
  takeRate,
  depositAmountError,
}: DepositConfigProps) {
  const [depositInput, setDepositInput] = useState(
    depositAmountCents > 0 ? (depositAmountCents / 100).toFixed(2) : '',
  );

  const depositExceedsBase = depositAmountCents >= basePriceCents && basePriceCents > 0;

  const takeRatePct = takeRate / 100;
  const depositFees = calcFees(depositAmountCents, takeRatePct);
  const balanceCents = basePriceCents - depositAmountCents;
  const balanceFees = calcFees(Math.max(0, balanceCents), takeRatePct);

  const showPayoutPreview =
    depositAmountCents > 0 && basePriceCents > depositAmountCents;

  return (
    <div className="mt-4">
      {/* Toggle row */}
      <div className="flex items-center justify-between p-5 rounded-2xl border border-gray-200 bg-white">
        <div>
          <p className="font-semibold text-gray-900">Require a deposit</p>
          <p className="text-sm text-gray-500">
            Participants pay a deposit now and the remaining balance later.
          </p>
        </div>
        <Toggle
          checked={enabled}
          onChange={onToggle}
          disabled={!available}
        />
      </div>

      {/* Upgrade prompt for Foundation plan */}
      {!available && (
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
          <Lock size={16} className="text-gray-400 shrink-0" />
          <p className="text-sm text-gray-600">
            Deposit payments are available on Creator and Studio plans.{' '}
            <a href="/organization/settings/billing" className="text-[#0FA3B1] hover:underline font-medium">
              Upgrade Plan
            </a>
          </p>
        </div>
      )}

      {/* Expanded deposit form */}
      {available && enabled && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 mt-2">
          {/* Non-refundable warning */}
          <div className="flex items-start gap-3 mb-5">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-amber-800">
              Deposits are non-refundable by default. Participants will be clearly
              informed of this at checkout. Review your refund policy below.
            </p>
          </div>

          {/* Deposit amount */}
          <label className="text-sm font-semibold text-gray-700 block mb-2">
            Deposit Amount
          </label>
          <div className="relative flex items-center mb-1">
            <span className="absolute left-4 text-gray-400 select-none">$</span>
            <input
              type="text"
              inputMode="decimal"
              className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900
                focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1] bg-white"
              placeholder="0.00"
              value={depositInput}
              onChange={(e) => {
                const raw = e.target.value;
                if (!/^[0-9]*\.?[0-9]*$/.test(raw)) return;
                setDepositInput(raw);
                const parsed = parseFloat(raw);
                onDepositAmountChange(isNaN(parsed) ? 0 : Math.round(parsed * 100));
              }}
              onBlur={() => {
                const cents = depositAmountCents;
                if (cents > 0) setDepositInput((cents / 100).toFixed(2));
              }}
            />
          </div>
          {(depositExceedsBase || depositAmountError) && (
            <p className="text-sm text-red-600 mb-4">
              {depositAmountError ?? 'Deposit cannot exceed the full registration price.'}
            </p>
          )}
          {!depositExceedsBase && !depositAmountError && <div className="mb-4" />}

          {/* Balance due date */}
          <label className="text-sm font-semibold text-gray-700 block mb-2">
            Balance Due Date
          </label>
          <input
            type="date"
            max={workshopStartDate ?? undefined}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm mb-2 bg-white
              focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]"
            value={balanceDueDate}
            onChange={(e) => onBalanceDueDateChange(e.target.value)}
          />
          <p className="text-xs text-gray-400 mb-4">
            Must be before the workshop start date. Participants will be reminded
            30, 7, and 2 days before this date.
          </p>

          {/* Auto-charge toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Auto-charge balance</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Automatically charge the saved payment method on the balance due date.
                If off, participants receive a payment link.
              </p>
            </div>
            <Toggle
              checked={balanceAutoCharge}
              onChange={onBalanceAutoChargeChange}
            />
          </div>

          {/* Deposit payout preview */}
          {showPayoutPreview && (
            <div className="mt-4 pt-4 border-t border-amber-200 space-y-1 text-xs text-amber-900">
              <div className="flex justify-between">
                <span>Deposit payout (est.)</span>
                <span>{formatCents(depositFees.payoutCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Balance payout (est.)</span>
                <span>{formatCents(balanceFees.payoutCents)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-1 border-t border-amber-200">
                <span>Total payout (est.)</span>
                <span>{formatCents(depositFees.payoutCents + balanceFees.payoutCents)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

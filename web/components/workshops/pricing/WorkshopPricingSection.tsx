'use client';

import { useState, useEffect, useCallback } from 'react';
import { Toggle } from '@/components/ui/Toggle';
import { RevenueCalculator } from './RevenueCalculator';
import { DepositConfig } from './DepositConfig';
import { CommitmentDateSection } from './CommitmentDateSection';
import { RefundPolicySection } from './RefundPolicySection';
import { PricingTierSection } from './PricingTierSection';
import { TAKE_RATE_BY_PLAN, DEPOSIT_PLANS } from '@/lib/utils/currency';
import { apiGet, apiPost, apiPut, ApiError } from '@/lib/api/client';
import type { PriceTier } from '@/lib/api/priceTiers';
import toast from 'react-hot-toast';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface WorkshopPricingData {
  id?: number;
  base_price_cents: number;
  is_paid: boolean;
  deposit_enabled: boolean;
  deposit_amount_cents: number | null;
  deposit_is_nonrefundable: boolean;
  balance_due_date: string | null;
  balance_auto_charge: boolean;
  commitment_date: string | null;
  commitment_description: string | null;
  post_commitment_refund_pct: number | null;
}

interface RefundPolicyData {
  id?: number;
  scope?: 'organization' | 'workshop';
  full_refund_cutoff_days: number;
  partial_refund_cutoff_days: number;
  partial_refund_pct: number;
  no_refund_cutoff_hours: number;
  custom_policy_text?: string | null;
}

interface WorkshopPricingSectionProps {
  workshopId: number;
  workshopStartDate?: string;
  planCode: string;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

export function WorkshopPricingSection({
  workshopId,
  workshopStartDate,
  planCode,
}: WorkshopPricingSectionProps) {
  const takeRate = TAKE_RATE_BY_PLAN[planCode] ?? 2.0;
  const depositAvailable = DEPOSIT_PLANS.has(planCode);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  // Pricing form state
  const [isPaid, setIsPaid] = useState(false);
  const [basePriceCents, setBasePriceCents] = useState(0);
  const [basePriceInput, setBasePriceInput] = useState('');
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositAmountCents, setDepositAmountCents] = useState(0);
  const [balanceDueDate, setBalanceDueDate] = useState('');
  const [balanceAutoCharge, setBalanceAutoCharge] = useState(false);
  const [commitmentDate, setCommitmentDate] = useState('');
  const [commitmentDescription, setCommitmentDescription] = useState('');
  const [postCommitmentRefundPct, setPostCommitmentRefundPct] = useState(0);

  const [refundPolicy, setRefundPolicy] = useState<RefundPolicyData | null>(null);
  const [isWorkshopRefundOverride, setIsWorkshopRefundOverride] = useState(false);

  // Tier state (lifted from PricingTierSection for RevenueCalculator)
  const [tiers, setTiers] = useState<PriceTier[]>([]);

  // Field-level validation errors
  const [priceError, setPriceError] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pricingRes, policyRes] = await Promise.allSettled([
        apiGet<WorkshopPricingData>(`/workshops/${workshopId}/pricing`),
        apiGet<RefundPolicyData>(`/workshops/${workshopId}/refund-policy`),
      ]);

      if (pricingRes.status === 'fulfilled') {
        const p = pricingRes.value;
        setHasExisting(true);
        setIsPaid(p.is_paid ?? false);
        setBasePriceCents(p.base_price_cents ?? 0);
        setBasePriceInput(p.base_price_cents > 0 ? (p.base_price_cents / 100).toFixed(2) : '');
        setDepositEnabled(p.deposit_enabled ?? false);
        setDepositAmountCents(p.deposit_amount_cents ?? 0);
        setBalanceDueDate(p.balance_due_date ?? '');
        setBalanceAutoCharge(p.balance_auto_charge ?? false);
        setCommitmentDate(p.commitment_date ?? '');
        setCommitmentDescription(p.commitment_description ?? '');
        setPostCommitmentRefundPct(p.post_commitment_refund_pct ?? 0);
      }

      if (policyRes.status === 'fulfilled') {
        const pol = policyRes.value;
        setRefundPolicy(pol);
        setIsWorkshopRefundOverride(pol.scope === 'workshop');
      }
    } catch {
      // 404 is normal for a new workshop without pricing
    } finally {
      setLoading(false);
    }
  }, [workshopId]);

  useEffect(() => { load(); }, [load]);

  /* ── Validation ── */

  function validatePrice(): boolean {
    if (!isPaid) return true;
    if (basePriceCents <= 0) {
      setPriceError('Please enter a registration price.');
      return false;
    }
    setPriceError(null);
    return true;
  }

  function validateDeposit(): boolean {
    if (!depositEnabled) return true;
    if (depositAmountCents <= 0) {
      setDepositError('Please enter a deposit amount.');
      return false;
    }
    if (depositAmountCents >= basePriceCents) {
      setDepositError('Deposit cannot exceed the full registration price.');
      return false;
    }
    setDepositError(null);
    return true;
  }

  /* ── Save ── */

  async function handleSave() {
    const priceOk = validatePrice();
    const depositOk = validateDeposit();
    if (!priceOk || !depositOk) return;

    setSaving(true);
    try {
      const payload = {
        is_paid: isPaid,
        base_price_cents: isPaid ? basePriceCents : 0,
        deposit_enabled: isPaid && depositEnabled && depositAvailable,
        deposit_amount_cents: depositEnabled ? depositAmountCents : null,
        deposit_is_nonrefundable: true,
        balance_due_date: depositEnabled ? balanceDueDate || null : null,
        balance_auto_charge: balanceAutoCharge,
        commitment_date: commitmentDate || null,
        commitment_description: commitmentDescription || null,
        post_commitment_refund_pct: commitmentDate ? postCommitmentRefundPct : null,
      };

      if (hasExisting) {
        await apiPut(`/workshops/${workshopId}/pricing`, payload);
      } else {
        await apiPost(`/workshops/${workshopId}/pricing`, payload);
        setHasExisting(true);
      }

      toast.success('Pricing saved');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const first = Object.values(err.errors).flat()[0];
        toast.error(first || 'Validation error — please check your inputs.');
      } else {
        toast.error('Failed to save pricing');
      }
    } finally {
      setSaving(false);
    }
  }

  /* ── Render ── */

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-2xl border border-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-[720px] space-y-1">
      {/* ── Paid/Free toggle ── */}
      <div className="flex items-center justify-between p-5 rounded-2xl border border-gray-200 bg-white">
        <div>
          <p className="font-semibold text-gray-900">Paid Workshop</p>
          <p className="text-sm text-gray-500">
            Charge participants to register for this workshop.
          </p>
        </div>
        <Toggle
          checked={isPaid}
          onChange={(v) => {
            setIsPaid(v);
            if (!v) {
              setPriceError(null);
              setDepositError(null);
            }
          }}
        />
      </div>

      {!isPaid && (
        <div className="flex items-center justify-center py-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200
            px-3 py-1 text-xs font-semibold text-green-700">
            Free registration — no payment required
          </span>
        </div>
      )}

      {/* ── Price input ── */}
      {isPaid && (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 mt-4">
            <label className="text-sm font-semibold text-gray-700 block mb-2">
              Registration Price
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-gray-400 font-medium select-none">$</span>
              <input
                type="text"
                inputMode="decimal"
                className={`w-full pl-8 pr-4 py-3 border rounded-xl text-gray-900
                  font-semibold text-lg focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]
                  ${priceError ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="0.00"
                value={basePriceInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (!/^[0-9]*\.?[0-9]*$/.test(raw)) return;
                  setBasePriceInput(raw);
                  const parsed = parseFloat(raw);
                  const cents = isNaN(parsed) ? 0 : Math.round(parsed * 100);
                  setBasePriceCents(cents);
                  if (priceError && cents > 0) setPriceError(null);
                }}
                onBlur={() => {
                  if (basePriceCents > 0) setBasePriceInput((basePriceCents / 100).toFixed(2));
                }}
              />
            </div>
            {priceError ? (
              <p className="text-xs text-red-600 mt-2">{priceError}</p>
            ) : (
              <p className="text-xs text-gray-400 mt-2">
                Enter the full registration price in USD. Participants pay this amount at checkout.
              </p>
            )}
          </div>

          {/* ── Revenue calculator ── */}
          <RevenueCalculator
            basePriceCents={basePriceCents}
            takeRate={takeRate}
            planCode={planCode}
            tiers={tiers}
          />

          {/* ── Price tiers ── */}
          <PricingTierSection
            workshopId={workshopId}
            workshopStartDate={workshopStartDate}
            planCode={planCode}
            basePriceCents={basePriceCents}
            onTiersChange={setTiers}
          />

          {/* ── Deposit configuration ── */}
          <DepositConfig
            available={depositAvailable}
            enabled={depositEnabled}
            onToggle={(v) => {
              setDepositEnabled(v);
              if (!v) setDepositError(null);
            }}
            depositAmountCents={depositAmountCents}
            onDepositAmountChange={(c) => {
              setDepositAmountCents(c);
              if (depositError && c > 0 && c < basePriceCents) setDepositError(null);
            }}
            basePriceCents={basePriceCents}
            balanceDueDate={balanceDueDate}
            onBalanceDueDateChange={setBalanceDueDate}
            workshopStartDate={workshopStartDate}
            balanceAutoCharge={balanceAutoCharge}
            onBalanceAutoChargeChange={setBalanceAutoCharge}
            takeRate={takeRate}
            depositAmountError={depositError}
          />

          {/* ── Commitment date ── */}
          <CommitmentDateSection
            commitmentDate={commitmentDate}
            onCommitmentDateChange={setCommitmentDate}
            commitmentDescription={commitmentDescription}
            onCommitmentDescriptionChange={setCommitmentDescription}
            postCommitmentRefundPct={postCommitmentRefundPct}
            onPostCommitmentRefundPctChange={setPostCommitmentRefundPct}
            workshopStartDate={workshopStartDate}
          />
        </>
      )}

      {/* ── Refund policy ── */}
      <RefundPolicySection
        workshopId={workshopId}
        policy={refundPolicy}
        isWorkshopOverride={isWorkshopRefundOverride}
        onPolicyUpdated={(p) => {
          setRefundPolicy(p);
          setIsWorkshopRefundOverride(true);
        }}
      />

      {/* ── Save button ── */}
      <div className="pt-4 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-[#0FA3B1] text-white font-semibold text-sm
            hover:bg-[#0c8a96] transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save Pricing'}
        </button>
      </div>
    </div>
  );
}

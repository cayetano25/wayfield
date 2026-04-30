'use client';

import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { formatCents } from '@/lib/utils/currency';
import { createPriceTier, updatePriceTier } from '@/lib/api/priceTiers';
import type { PriceTier, CreateTierPayload } from '@/lib/api/priceTiers';
import { ApiError } from '@/lib/api/client';

type TriggerType = 'date' | 'capacity' | 'combo';

function detectTriggerType(tier: PriceTier): TriggerType {
  const hasDate = tier.valid_from !== null || tier.valid_until !== null;
  const hasCap = tier.capacity_limit !== null;
  if (hasDate && hasCap) return 'combo';
  if (hasCap) return 'capacity';
  return 'date';
}

function formatDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateDisplay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface AddEditTierModalProps {
  open: boolean;
  onClose: () => void;
  workshopId: number;
  workshopStartDate?: string;
  basePriceCents: number;
  tier?: PriceTier | null;
  onSaved: (tier: PriceTier) => void;
}

export function AddEditTierModal({
  open,
  onClose,
  workshopId,
  workshopStartDate,
  basePriceCents,
  tier,
  onSaved,
}: AddEditTierModalProps) {
  const isEditing = !!tier;
  const priceLocked = isEditing && (tier?.registrations_at_tier ?? 0) > 0;

  const [label, setLabel] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [priceCents, setPriceCents] = useState(0);
  const [triggerType, setTriggerType] = useState<TriggerType>('date');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [capacityLimit, setCapacityLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (tier) {
      setLabel(tier.label);
      setPriceCents(tier.price_cents);
      setPriceInput((tier.price_cents / 100).toFixed(2));
      setTriggerType(detectTriggerType(tier));
      setValidFrom(tier.valid_from ? formatDateTimeLocal(tier.valid_from) : '');
      setValidUntil(tier.valid_until ? formatDateTimeLocal(tier.valid_until) : '');
      setCapacityLimit(tier.capacity_limit != null ? String(tier.capacity_limit) : '');
    } else {
      setLabel('');
      setPriceCents(0);
      setPriceInput('');
      setTriggerType('date');
      setValidFrom('');
      setValidUntil('');
      setCapacityLimit('');
    }
    setPriceError(null);
  }, [open, tier]);

  const hasDateTrigger = triggerType === 'date' || triggerType === 'combo';
  const hasCapacityTrigger = triggerType === 'capacity' || triggerType === 'combo';

  function validate(): boolean {
    if (!label.trim()) {
      toast.error('Please enter a tier label.');
      return false;
    }
    if (!priceLocked) {
      if (priceCents <= 0) {
        setPriceError('Please enter a valid price.');
        return false;
      }
      if (basePriceCents > 0 && priceCents > basePriceCents) {
        setPriceError('Tier price cannot exceed the base registration price.');
        return false;
      }
    }
    return true;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: CreateTierPayload = {
        label: label.trim(),
        price_cents: priceCents,
        valid_from: hasDateTrigger && validFrom ? new Date(validFrom).toISOString() : null,
        valid_until: hasDateTrigger && validUntil ? new Date(validUntil).toISOString() : null,
        capacity_limit: hasCapacityTrigger && capacityLimit ? parseInt(capacityLimit, 10) : null,
      };

      let result: { data: PriceTier };
      if (isEditing && tier) {
        const updatePayload: Partial<CreateTierPayload> = {
          label: payload.label,
          valid_from: payload.valid_from,
          valid_until: payload.valid_until,
          capacity_limit: payload.capacity_limit,
        };
        if (!priceLocked) updatePayload.price_cents = payload.price_cents;
        result = await updatePriceTier(workshopId, tier.id, updatePayload);
      } else {
        result = await createPriceTier(workshopId, payload);
      }

      onSaved(result.data);
      toast.success(isEditing ? 'Tier updated' : 'Tier added');
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const first = Object.values(err.errors).flat()[0];
        toast.error(first || 'Validation error');
      } else {
        toast.error('Failed to save tier');
      }
    } finally {
      setSaving(false);
    }
  }

  const workshopMaxDate = workshopStartDate
    ? `${workshopStartDate}T23:59`
    : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Tier' : 'Add Price Tier'}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-[#0FA3B1] text-white font-semibold text-sm
              hover:bg-[#0c8a96] transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Tier'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Label */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1.5">Label</label>
          <input
            type="text"
            placeholder="Early Bird"
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900
              focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">Shown to participants on the workshop page.</p>
        </div>

        {/* Price */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1.5">Price</label>
          {priceLocked ? (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
              <p className="text-2xl font-bold text-gray-900">{formatCents(tier!.price_cents)}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                <Lock size={11} />
                Price locked — {tier!.registrations_at_tier} registration(s) at this price.
              </p>
            </div>
          ) : (
            <>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-gray-400 font-medium select-none">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className={`w-full pl-8 pr-4 py-2.5 border rounded-xl text-gray-900 text-sm
                    focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]
                    ${priceError ? 'border-red-400' : 'border-gray-300'}`}
                  value={priceInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (!/^[0-9]*\.?[0-9]*$/.test(raw)) return;
                    setPriceInput(raw);
                    const parsed = parseFloat(raw);
                    const cents = isNaN(parsed) ? 0 : Math.round(parsed * 100);
                    setPriceCents(cents);
                    if (priceError) setPriceError(null);
                  }}
                  onBlur={() => {
                    if (priceCents > 0) setPriceInput((priceCents / 100).toFixed(2));
                  }}
                />
              </div>
              {priceError && <p className="text-xs text-red-600 mt-1">{priceError}</p>}
              {!priceError && basePriceCents > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Must not exceed the base price of {formatCents(basePriceCents)}.
                </p>
              )}
            </>
          )}
        </div>

        {/* Trigger type */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1.5">
            Trigger Type
          </label>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            {(['date', 'capacity', 'combo'] as TriggerType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTriggerType(type)}
                className={`flex-1 py-2 text-sm font-medium transition-colors
                  ${triggerType === type
                    ? 'bg-[#0FA3B1] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
              >
                {type === 'date' ? 'Date' : type === 'capacity' ? 'Availability' : 'Date + Availability'}
              </button>
            ))}
          </div>
        </div>

        {/* Date fields */}
        {hasDateTrigger && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                Valid From <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="datetime-local"
                max={workshopMaxDate}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm
                  focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank to start immediately.</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                Valid Until
              </label>
              <input
                type="datetime-local"
                max={workshopMaxDate}
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm
                  focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Tier ends at midnight on this date. Must be before workshop start.
              </p>
            </div>
          </div>
        )}

        {/* Capacity field */}
        {hasCapacityTrigger && (
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              Seats at this price
            </label>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="10"
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm
                focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]"
              value={capacityLimit}
              onChange={(e) => setCapacityLimit(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              {hasDateTrigger
                ? 'Tier ends when the date passes OR when seats fill — whichever comes first.'
                : 'Tier closes after this many registrations.'}
            </p>
          </div>
        )}

        {/* Live preview */}
        {priceCents > 0 && (
          <div className="rounded-xl bg-teal-50 border border-teal-200 p-3">
            <p className="text-xs text-gray-500 mb-1">Participants will see:</p>
            <p className="text-lg font-bold text-[#0FA3B1]">{formatCents(priceCents)}</p>
            {hasDateTrigger && validUntil && (
              <p className="text-xs text-gray-600">
                Available until {formatDateDisplay(validUntil)}
                {hasCapacityTrigger && capacityLimit ? ' or' : ''}
              </p>
            )}
            {hasCapacityTrigger && capacityLimit && (
              <p className="text-xs text-gray-600">
                First {capacityLimit} registrations only
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

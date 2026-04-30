'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Tag,
  Pencil,
  Trash2,
  Users,
  Lock,
  ChevronUp,
  ChevronDown,
  GripVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { PricingTimeline } from './PricingTimeline';
import { AddEditTierModal } from './AddEditTierModal';
import { formatCents, TIER_PLANS } from '@/lib/utils/currency';
import {
  listPriceTiers,
  deletePriceTier,
  reorderPriceTiers,
} from '@/lib/api/priceTiers';
import type { PriceTier } from '@/lib/api/priceTiers';

/* ─── Status chip ─────────────────────────────────────────────────────────── */

function getTierStatus(tier: PriceTier): { dotClass: string; label: string } {
  if (tier.capacity_limit !== null && tier.remaining_capacity === 0) {
    return { dotClass: 'bg-orange-400', label: 'Sold out' };
  }
  if (tier.is_currently_active) {
    return { dotClass: 'bg-[#0FA3B1]', label: 'Active' };
  }
  const now = Date.now();
  if (tier.valid_from && new Date(tier.valid_from).getTime() > now) {
    return {
      dotClass: 'bg-blue-400',
      label: `Starts ${new Date(tier.valid_from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    };
  }
  return { dotClass: 'bg-gray-300', label: 'Ended' };
}

/* ─── Constraints summary ─────────────────────────────────────────────────── */

function formatTierConstraints(tier: PriceTier): string {
  const hasDate = tier.valid_from !== null || tier.valid_until !== null;
  const hasCap = tier.capacity_limit !== null;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (hasDate && hasCap) {
    const datePart = tier.valid_until ? `Until ${fmtDate(tier.valid_until)}` : 'Active now';
    return `${datePart} or first ${tier.capacity_limit} seats`;
  }
  if (hasDate) {
    if (tier.valid_from && tier.valid_until) {
      return `Opens ${fmtDate(tier.valid_from)} · Closes ${fmtDate(tier.valid_until)}`;
    }
    if (tier.valid_until) return `Valid until ${fmtDate(tier.valid_until)}`;
    if (tier.valid_from) return `Opens ${fmtDate(tier.valid_from)}`;
  }
  if (hasCap) {
    const remaining = tier.remaining_capacity ?? tier.capacity_limit;
    return `${remaining} of ${tier.capacity_limit} spots at this price`;
  }
  return 'No restrictions';
}

/* ─── Delete confirmation modal ───────────────────────────────────────────── */

interface DeleteConfirmProps {
  open: boolean;
  tier: PriceTier | null;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}

function DeleteConfirmModal({ open, tier, onClose, onConfirm, deleting }: DeleteConfirmProps) {
  if (!tier) return null;
  const hasRegistrations = tier.registrations_at_tier > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Remove this tier?"
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#0FA3B1] text-white font-semibold text-sm
              hover:bg-[#0c8a96] transition-colors"
          >
            Keep Tier
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 rounded-xl border border-red-300 text-red-600 font-semibold text-sm
              hover:bg-red-50 transition-colors disabled:opacity-60"
          >
            {deleting ? 'Removing…' : 'Remove Tier'}
          </button>
        </>
      }
    >
      {hasRegistrations ? (
        <p className="text-sm text-gray-700 leading-relaxed">
          <span className="font-semibold">{tier.label}</span> has been used by{' '}
          {tier.registrations_at_tier} participant(s). Removing it will not affect their pricing,
          but future registrations will move to the next active tier or base price.
        </p>
      ) : (
        <p className="text-sm text-gray-700 leading-relaxed">
          &lsquo;{tier.label}&rsquo; will be removed. This cannot be undone.
        </p>
      )}
    </Modal>
  );
}

/* ─── Foundation plan upsell ──────────────────────────────────────────────── */

function TierUpsellNotice() {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mt-4">
      <div className="flex items-start gap-3">
        <Tag className="text-gray-400 shrink-0 mt-0.5" size={16} />
        <div>
          <p className="text-sm font-medium text-gray-900">Early-bird pricing — Creator &amp; Studio</p>
          <p className="text-sm text-gray-500">
            Create automatic price tiers that change based on date or availability. Available on
            Creator and Studio plans.
          </p>
          <a
            href="/organization/settings/billing"
            className="text-sm font-semibold text-[#0FA3B1] hover:text-[#0c8a96] mt-2 inline-block"
          >
            Upgrade plan
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── Main section ────────────────────────────────────────────────────────── */

interface PricingTierSectionProps {
  workshopId: number;
  workshopStartDate?: string;
  planCode: string;
  basePriceCents: number;
  onTiersChange?: (tiers: PriceTier[]) => void;
}

export function PricingTierSection({
  workshopId,
  workshopStartDate,
  planCode,
  basePriceCents,
  onTiersChange,
}: PricingTierSectionProps) {
  const tiersEnabled = TIER_PLANS.has(planCode);

  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [editTier, setEditTier] = useState<PriceTier | null>(null);
  const [deleteTier, setDeleteTier] = useState<PriceTier | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragOverRef = useRef<number | null>(null);

  const updateTiers = useCallback(
    (next: PriceTier[]) => {
      const sorted = [...next].sort((a, b) => a.sort_order - b.sort_order);
      setTiers(sorted);
      onTiersChange?.(sorted);
    },
    [onTiersChange],
  );

  const load = useCallback(async () => {
    if (!tiersEnabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await listPriceTiers(workshopId);
      updateTiers(res.data);
    } catch {
      // 402 = plan not enabled — already gated by tiersEnabled
    } finally {
      setLoading(false);
    }
  }, [workshopId, tiersEnabled, updateTiers]);

  useEffect(() => {
    load();
  }, [load]);

  /* ── Drag to reorder ── */

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragOverRef.current !== index) {
      dragOverRef.current = index;
      setDropIndex(index);
    }
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDropIndex(null);
    dragOverRef.current = null;
  }

  async function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      handleDragEnd();
      return;
    }
    const reordered = [...tiers];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    const withOrder = reordered.map((t, i) => ({ ...t, sort_order: i }));
    updateTiers(withOrder);
    handleDragEnd();

    try {
      await reorderPriceTiers(
        workshopId,
        withOrder.map((t) => ({ id: t.id, sort_order: t.sort_order })),
      );
    } catch {
      toast.error('Failed to save new order');
      load();
    }
  }

  /* ── Move up/down (mobile) ── */

  async function moveInDirection(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= tiers.length) return;
    const reordered = [...tiers];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const withOrder = reordered.map((t, i) => ({ ...t, sort_order: i }));
    updateTiers(withOrder);
    try {
      await reorderPriceTiers(
        workshopId,
        withOrder.map((t) => ({ id: t.id, sort_order: t.sort_order })),
      );
    } catch {
      toast.error('Failed to save new order');
      load();
    }
  }

  /* ── Delete ── */

  async function handleDelete() {
    if (!deleteTier) return;
    setDeleting(true);
    try {
      await deletePriceTier(workshopId, deleteTier.id);
      const next = tiers.filter((t) => t.id !== deleteTier.id);
      updateTiers(next);
      toast.success('Tier removed');
      setDeleteTier(null);
    } catch {
      toast.error('Failed to remove tier');
    } finally {
      setDeleting(false);
    }
  }

  /* ── Render ── */

  if (!tiersEnabled) {
    return <TierUpsellNotice />;
  }

  if (loading) {
    return (
      <div className="mt-8">
        <div className="h-5 bg-gray-100 rounded w-24 animate-pulse mb-4" />
        <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="mt-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Price Tiers</h3>
          <p className="text-sm text-gray-500">
            Automatically change the price based on date or availability. Participants get the
            active tier price — no code required.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 text-sm font-semibold text-[#0FA3B1]
            hover:text-[#0c8a96] transition-colors whitespace-nowrap ml-4"
        >
          <Plus size={15} /> Add Tier
        </button>
      </div>

      {/* Timeline */}
      {tiers.length > 0 && (
        <PricingTimeline
          tiers={tiers}
          workshopStartDate={workshopStartDate}
          basePriceCents={basePriceCents}
        />
      )}

      {/* Tier list */}
      {tiers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center">
          <Tag className="text-gray-300 mx-auto mb-3" size={28} />
          <p className="text-sm font-medium text-gray-700">No price tiers yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Add a tier to offer early-bird pricing or automatically adjust price by availability.
          </p>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-4 text-sm font-semibold text-[#0FA3B1] hover:text-[#0c8a96] transition-colors"
          >
            + Add your first tier
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {tiers.map((tier, index) => {
            const { dotClass, label: statusLabel } = getTierStatus(tier);
            const priceLocked = tier.is_currently_active && tier.registrations_at_tier > 0;
            const isDragging = dragIndex === index;
            const isDropTarget = dropIndex === index && dragIndex !== null && dragIndex !== index;

            return (
              <div
                key={tier.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 rounded-2xl border bg-white p-4 transition-all
                  ${isDragging ? 'opacity-50 scale-[0.99]' : ''}
                  ${isDropTarget ? 'border-[#0FA3B1] ring-1 ring-[#0FA3B1]' : 'border-gray-200'}
                `}
              >
                {/* Mobile reorder arrows */}
                <div className="flex flex-col gap-0.5 sm:hidden">
                  <button
                    type="button"
                    onClick={() => moveInDirection(index, -1)}
                    disabled={index === 0}
                    className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveInDirection(index, 1)}
                    disabled={index === tiers.length - 1}
                    className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                {/* Desktop drag handle */}
                <div className="hidden sm:flex items-center text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing">
                  <GripVertical size={16} />
                </div>

                {/* Tier info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900 truncate">
                      {tier.label}
                    </span>
                    <span className="font-bold text-sm text-[#0FA3B1] whitespace-nowrap">
                      {formatCents(tier.price_cents)}
                    </span>
                    {priceLocked && (
                      <span className="text-gray-400" title="Price cannot be changed — participants have already registered at this price.">
                        <Lock size={12} />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {formatTierConstraints(tier)}
                  </p>
                  {tier.registrations_at_tier > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Used {tier.registrations_at_tier} time(s)
                    </p>
                  )}
                </div>

                {/* Right side */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100">
                    <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                    {statusLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditTier(tier)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTier(tier)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add tier modal */}
      <AddEditTierModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        workshopId={workshopId}
        workshopStartDate={workshopStartDate}
        basePriceCents={basePriceCents}
        tier={null}
        onSaved={(saved) => {
          updateTiers([...tiers, saved]);
        }}
      />

      {/* Edit tier modal */}
      <AddEditTierModal
        open={!!editTier}
        onClose={() => setEditTier(null)}
        workshopId={workshopId}
        workshopStartDate={workshopStartDate}
        basePriceCents={basePriceCents}
        tier={editTier}
        onSaved={(saved) => {
          updateTiers(tiers.map((t) => (t.id === saved.id ? saved : t)));
          setEditTier(null);
        }}
      />

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        open={!!deleteTier}
        tier={deleteTier}
        onClose={() => setDeleteTier(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}

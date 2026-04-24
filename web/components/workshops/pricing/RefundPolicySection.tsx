'use client';

import { useState } from 'react';
import { apiPost, apiPut, ApiError } from '@/lib/api/client';
import toast from 'react-hot-toast';

interface RefundPolicy {
  id?: number;
  scope?: 'organization' | 'workshop';
  full_refund_cutoff_days: number;
  partial_refund_cutoff_days: number;
  partial_refund_pct: number;
  no_refund_cutoff_hours: number;
  custom_policy_text?: string | null;
}

interface RefundPolicySectionProps {
  workshopId: number;
  policy: RefundPolicy | null;
  isWorkshopOverride: boolean;
  onPolicyUpdated: (policy: RefundPolicy) => void;
}

interface PolicyFormState {
  full_refund_cutoff_days: number;
  partial_refund_cutoff_days: number;
  partial_refund_pct: number;
  no_refund_cutoff_hours: number;
  custom_policy_text: string;
}

export function RefundPolicySection({
  workshopId,
  policy,
  isWorkshopOverride,
  onPolicyUpdated,
}: RefundPolicySectionProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<PolicyFormState>>({});

  const [form, setForm] = useState<PolicyFormState>({
    full_refund_cutoff_days:    policy?.full_refund_cutoff_days    ?? 30,
    partial_refund_cutoff_days: policy?.partial_refund_cutoff_days ?? 14,
    partial_refund_pct:         policy?.partial_refund_pct         ?? 50,
    no_refund_cutoff_hours:     policy?.no_refund_cutoff_hours     ?? 48,
    custom_policy_text:         policy?.custom_policy_text         ?? '',
  });

  function setField<K extends keyof PolicyFormState>(key: K, value: PolicyFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<PolicyFormState> = {};
    if (form.full_refund_cutoff_days < 0) errs.full_refund_cutoff_days = 0;
    if (form.partial_refund_cutoff_days < 0) errs.partial_refund_cutoff_days = 0;
    if (form.partial_refund_pct < 0 || form.partial_refund_pct > 100) errs.partial_refund_pct = 0;
    if (form.no_refund_cutoff_hours < 0) errs.no_refund_cutoff_hours = 0;
    if (
      form.partial_refund_cutoff_days >= form.full_refund_cutoff_days &&
      form.full_refund_cutoff_days > 0
    ) {
      errs.partial_refund_cutoff_days = 0;
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        full_refund_cutoff_days:    form.full_refund_cutoff_days,
        partial_refund_cutoff_days: form.partial_refund_cutoff_days,
        partial_refund_pct:         form.partial_refund_pct,
        no_refund_cutoff_hours:     form.no_refund_cutoff_hours,
        custom_policy_text:         form.custom_policy_text || null,
      };
      let saved: RefundPolicy;
      if (isWorkshopOverride && policy?.id) {
        saved = await apiPut(`/workshops/${workshopId}/refund-policy`, payload);
      } else {
        saved = await apiPost(`/workshops/${workshopId}/refund-policy`, payload);
      }
      onPolicyUpdated(saved);
      setEditing(false);
      toast.success('Refund policy saved');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const errs: Partial<PolicyFormState> = {};
        for (const [k, msgs] of Object.entries(err.errors)) {
          if (k in form) (errs as Record<string, unknown>)[k] = (msgs as string[])[0];
        }
        setFormErrors(errs);
        toast.error('Please fix the errors below');
      } else {
        toast.error('Failed to save refund policy');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditing(false);
    setForm({
      full_refund_cutoff_days:    policy?.full_refund_cutoff_days    ?? 30,
      partial_refund_cutoff_days: policy?.partial_refund_cutoff_days ?? 14,
      partial_refund_pct:         policy?.partial_refund_pct         ?? 50,
      no_refund_cutoff_hours:     policy?.no_refund_cutoff_hours     ?? 48,
      custom_policy_text:         policy?.custom_policy_text         ?? '',
    });
    setFormErrors({});
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700">Refund Policy</p>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-[#0FA3B1] hover:underline"
          >
            {isWorkshopOverride ? 'Edit custom policy' : 'Customize for this workshop'}
          </button>
        )}
      </div>

      {!editing && policy ? (
        <>
          <div className="text-sm text-gray-600 space-y-1">
            <p>✓ Full refund up to {policy.full_refund_cutoff_days} days before start</p>
            <p>
              ✓ {policy.partial_refund_pct}% refund {policy.partial_refund_cutoff_days}–
              {policy.full_refund_cutoff_days} days before start
            </p>
            <p>✗ No refund within {policy.no_refund_cutoff_hours} hours of start</p>
          </div>
          {policy.custom_policy_text && (
            <p className="text-xs text-gray-500 mt-2 leading-relaxed border-t border-gray-200 pt-2">
              {policy.custom_policy_text}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-3">
            {isWorkshopOverride
              ? 'Custom policy for this workshop'
              : 'Inherited from your organization policy'}
          </p>
        </>
      ) : !editing ? (
        <p className="text-sm text-gray-500">No refund policy configured.</p>
      ) : null}

      {editing && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Full refund cutoff (days before start)
              </label>
              <input
                type="number"
                min="0"
                className={`w-full border rounded-xl px-3 py-2 text-sm
                  focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]
                  ${formErrors.full_refund_cutoff_days !== undefined ? 'border-red-400' : 'border-gray-300'}`}
                value={form.full_refund_cutoff_days}
                onChange={(e) => setField('full_refund_cutoff_days', parseInt(e.target.value, 10) || 0)}
              />
              {formErrors.full_refund_cutoff_days !== undefined && (
                <p className="text-xs text-red-600 mt-1">Must be a positive number.</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Partial refund cutoff (days before start)
              </label>
              <input
                type="number"
                min="0"
                className={`w-full border rounded-xl px-3 py-2 text-sm
                  focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]
                  ${formErrors.partial_refund_cutoff_days !== undefined ? 'border-red-400' : 'border-gray-300'}`}
                value={form.partial_refund_cutoff_days}
                onChange={(e) => setField('partial_refund_cutoff_days', parseInt(e.target.value, 10) || 0)}
              />
              {formErrors.partial_refund_cutoff_days !== undefined && (
                <p className="text-xs text-red-600 mt-1">
                  Must be less than the full refund cutoff.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Partial refund percentage (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                className={`w-full border rounded-xl px-3 py-2 text-sm
                  focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]
                  ${formErrors.partial_refund_pct !== undefined ? 'border-red-400' : 'border-gray-300'}`}
                value={form.partial_refund_pct}
                onChange={(e) => setField('partial_refund_pct', parseInt(e.target.value, 10) || 0)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                No-refund window (hours before start)
              </label>
              <input
                type="number"
                min="0"
                className={`w-full border rounded-xl px-3 py-2 text-sm
                  focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]
                  ${formErrors.no_refund_cutoff_hours !== undefined ? 'border-red-400' : 'border-gray-300'}`}
                value={form.no_refund_cutoff_hours}
                onChange={(e) => setField('no_refund_cutoff_hours', parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">
              Custom policy text (optional)
            </label>
            <textarea
              rows={3}
              placeholder="Additional refund policy details shown to participants…"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none
                focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1]"
              value={form.custom_policy_text}
              onChange={(e) => setField('custom_policy_text', e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700
                hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#0FA3B1] text-white text-sm font-semibold
                hover:bg-[#0c8a96] transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Policy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

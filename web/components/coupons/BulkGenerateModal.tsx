'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle,
  DollarSign,
  Download,
  Loader2,
  Percent,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ApiError } from '@/lib/api/client';
import { bulkGenerateCoupons, type BulkGenerateResult } from '@/lib/api/coupons';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Workshop {
  id: number;
  title: string;
}

interface BulkGenerateModalProps {
  organizationId: number;
  workshops: Workshop[];
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPreviewDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateStr + 'T12:00:00'));
  } catch {
    return dateStr;
  }
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
        {label}
        {required && <span style={{ color: '#E94F37', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{hint}</p>}
    </div>
  );
}

const inputStyle = (focused: boolean): React.CSSProperties => ({
  height: 40,
  padding: '0 12px',
  border: `1px solid ${focused ? '#0FA3B1' : '#E5E7EB'}`,
  borderRadius: 10,
  fontSize: 14,
  color: '#111827',
  backgroundColor: 'white',
  outline: 'none',
  transition: 'border-color 150ms',
  boxShadow: focused ? '0 0 0 3px rgba(15,163,177,0.1)' : 'none',
  width: '100%',
  boxSizing: 'border-box' as const,
  fontFamily: 'Plus Jakarta Sans, sans-serif',
});

// ─── Main modal ───────────────────────────────────────────────────────────────

export function BulkGenerateModal({
  organizationId,
  workshops,
  onClose,
  onSuccess,
}: BulkGenerateModalProps) {
  const [count, setCount] = useState('100');
  const [prefix, setPrefix] = useState('');
  const [label, setLabel] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed_amount' | 'free'>('percentage');
  const [discountPct, setDiscountPct] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [workshopId, setWorkshopId] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkGenerateResult | null>(null);

  const [countFocused, setCountFocused] = useState(false);
  const [prefixFocused, setPrefixFocused] = useState(false);
  const [labelFocused, setLabelFocused] = useState(false);
  const [discountValFocused, setDiscountValFocused] = useState(false);
  const [dateFocused, setDateFocused] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ─── Preview values ───────────────────────────────────────────────────────

  const countNum = parseInt(count) || 0;
  const codePreview = prefix ? `${prefix.toUpperCase()}-XXXXXX` : 'XXXXXX';

  function discountDisplay(): string {
    if (discountType === 'free') return 'FREE';
    if (discountType === 'percentage') {
      const n = parseFloat(discountPct);
      return isNaN(n) || n <= 0 ? '?% off' : `${n}% off`;
    }
    const n = parseFloat(discountAmount);
    return isNaN(n) || n <= 0 ? '$?.?? off' : `$${n.toFixed(2)} off`;
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!label.trim()) {
      toast.error('Internal label is required');
      return;
    }
    if (countNum < 1 || countNum > 500) {
      toast.error('Count must be between 1 and 500');
      return;
    }
    if (discountType === 'percentage') {
      const n = parseFloat(discountPct);
      if (isNaN(n) || n <= 0 || n > 100) {
        toast.error('Enter a discount percentage between 1 and 100');
        return;
      }
    }
    if (discountType === 'fixed_amount') {
      const n = parseFloat(discountAmount);
      if (isNaN(n) || n <= 0) {
        toast.error('Enter a positive discount amount');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: Parameters<typeof bulkGenerateCoupons>[1] = {
        count: countNum,
        label: label.trim(),
        discount_type: discountType,
      };

      if (prefix.trim()) payload.prefix = prefix.trim().toUpperCase();

      if (discountType === 'percentage') {
        payload.discount_pct = parseFloat(discountPct);
      } else if (discountType === 'fixed_amount') {
        payload.discount_amount_cents = Math.round(parseFloat(discountAmount) * 100);
      }

      if (validUntil) {
        payload.valid_until = new Date(validUntil + 'T00:00:00').toISOString();
      }

      if (workshopId) {
        payload.workshop_id = parseInt(workshopId);
      }

      const res = await bulkGenerateCoupons(organizationId, payload);
      setResult(res.data);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to generate codes');
    } finally {
      setSubmitting(false);
    }
  }, [
    organizationId,
    count,
    countNum,
    prefix,
    label,
    discountType,
    discountPct,
    discountAmount,
    validUntil,
    workshopId,
    onSuccess,
  ]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          width: '100%',
          maxWidth: 560,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid #E5E7EB',
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'Sora, sans-serif',
                fontWeight: 700,
                fontSize: 18,
                color: '#111827',
                margin: 0,
              }}
            >
              Generate Codes
            </h2>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 0' }}>
              Create a batch of unique single-use coupon codes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#6B7280',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {result ? (
            /* ── Success state ── */
            <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
              <CheckCircle
                size={40}
                style={{ color: '#22C55E', margin: '0 auto 12px' }}
              />
              <h3
                style={{
                  fontFamily: 'Sora, sans-serif',
                  fontWeight: 700,
                  fontSize: 18,
                  color: '#111827',
                  margin: '0 0 6px',
                }}
              >
                {result.generated} code{result.generated !== 1 ? 's' : ''} generated!
              </h3>
              <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px' }}>
                All codes are now active and ready to share.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <a
                  href={`/api/v1/organizations/${organizationId}/coupons/export?label=${encodeURIComponent(result.label)}`}
                  download
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#0FA3B1',
                    color: 'white',
                    fontWeight: 600,
                    padding: '10px 20px',
                    borderRadius: 10,
                    fontSize: 14,
                    textDecoration: 'none',
                    transition: 'background-color 150ms',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                  }}
                >
                  <Download size={15} />
                  Download CSV
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    border: '1px solid #D1D5DB',
                    color: '#374151',
                    fontWeight: 500,
                    padding: '10px 20px',
                    borderRadius: 10,
                    fontSize: 14,
                    cursor: 'pointer',
                    background: 'white',
                    transition: 'background-color 150ms',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                  }}
                >
                  Done
                </button>
              </div>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 16 }}>
                The CSV contains all {result.generated} codes. Share it with your partners
                or import it into your mailing tool.
              </p>
            </div>
          ) : (
            /* ── Form ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Row 1: count + prefix */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field
                  label="How many codes?"
                  required
                  hint="Up to 500 unique single-use codes at once."
                >
                  <input
                    type="number"
                    value={count}
                    min={1}
                    max={500}
                    placeholder="100"
                    onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ''))}
                    onFocus={() => setCountFocused(true)}
                    onBlur={() => setCountFocused(false)}
                    style={inputStyle(countFocused)}
                  />
                </Field>

                <Field
                  label="Code prefix"
                  hint='Codes will look like PARTNER-A3F7X2. Leave blank for random codes.'
                >
                  <input
                    type="text"
                    value={prefix}
                    maxLength={10}
                    placeholder="PARTNER"
                    onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    onFocus={() => setPrefixFocused(true)}
                    onBlur={() => setPrefixFocused(false)}
                    style={{
                      ...inputStyle(prefixFocused),
                      fontFamily: 'JetBrains Mono, monospace',
                      letterSpacing: '0.06em',
                    }}
                  />
                </Field>
              </div>

              {/* Internal label */}
              <Field
                label="Internal label"
                required
                hint="Used to identify and export this batch of codes."
              >
                <input
                  type="text"
                  value={label}
                  placeholder="Photography Association — Nov 2026"
                  onChange={(e) => setLabel(e.target.value)}
                  onFocus={() => setLabelFocused(true)}
                  onBlur={() => setLabelFocused(false)}
                  style={inputStyle(labelFocused)}
                />
              </Field>

              {/* Discount type segmented */}
              <Field label="Discount type" required>
                <div
                  style={{
                    display: 'flex',
                    borderRadius: 10,
                    border: '1px solid #E5E7EB',
                    overflow: 'hidden',
                  }}
                >
                  {([
                    { value: 'percentage', label: '% Percentage', icon: Percent },
                    { value: 'fixed_amount', label: '$ Fixed', icon: DollarSign },
                    { value: 'free', label: '✓ Free', icon: null },
                  ] as const).map(({ value, label: btnLabel, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDiscountType(value)}
                      style={{
                        flex: 1,
                        padding: '9px 6px',
                        fontSize: 13,
                        fontWeight: discountType === value ? 700 : 500,
                        border: 'none',
                        backgroundColor: discountType === value ? '#0FA3B1' : 'white',
                        color: discountType === value ? 'white' : '#374151',
                        cursor: 'pointer',
                        transition: 'all 150ms',
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      {Icon && <Icon size={12} />}
                      {btnLabel}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Discount amount (conditional) */}
              {discountType === 'percentage' && (
                <Field label="Discount percentage" required>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      value={discountPct}
                      min={1}
                      max={100}
                      placeholder="20"
                      onChange={(e) => setDiscountPct(e.target.value)}
                      onFocus={() => setDiscountValFocused(true)}
                      onBlur={() => setDiscountValFocused(false)}
                      style={{ ...inputStyle(discountValFocused), paddingRight: 32 }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 14,
                        color: '#9CA3AF',
                        pointerEvents: 'none',
                      }}
                    >
                      %
                    </span>
                  </div>
                </Field>
              )}

              {discountType === 'fixed_amount' && (
                <Field label="Discount amount" required>
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 14,
                        color: '#6B7280',
                        pointerEvents: 'none',
                      }}
                    >
                      $
                    </span>
                    <input
                      type="number"
                      value={discountAmount}
                      min={0.01}
                      step={0.01}
                      placeholder="40.00"
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      onFocus={() => setDiscountValFocused(true)}
                      onBlur={() => setDiscountValFocused(false)}
                      style={{ ...inputStyle(discountValFocused), paddingLeft: 26 }}
                    />
                  </div>
                </Field>
              )}

              {/* Valid until + workshop row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Valid until" hint="Leave blank to never expire.">
                  <div style={{ position: 'relative' }}>
                    <Calendar
                      size={14}
                      style={{
                        position: 'absolute',
                        left: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#9CA3AF',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="date"
                      value={validUntil}
                      onChange={(e) => setValidUntil(e.target.value)}
                      onFocus={() => setDateFocused(true)}
                      onBlur={() => setDateFocused(false)}
                      style={{
                        ...inputStyle(dateFocused),
                        paddingLeft: 34,
                      }}
                    />
                  </div>
                </Field>

                {workshops.length > 0 && (
                  <Field label="Limit to workshop" hint="Leave blank to apply to any workshop.">
                    <select
                      value={workshopId}
                      onChange={(e) => setWorkshopId(e.target.value)}
                      style={{
                        height: 40,
                        padding: '0 12px',
                        border: '1px solid #E5E7EB',
                        borderRadius: 10,
                        fontSize: 14,
                        color: workshopId ? '#111827' : '#9CA3AF',
                        backgroundColor: 'white',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">Any workshop</option>
                      {workshops.map((w) => (
                        <option key={w.id} value={String(w.id)}>
                          {w.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>

              {/* Preview */}
              <div
                style={{
                  borderRadius: 12,
                  backgroundColor: '#F9FAFB',
                  padding: '16px',
                  marginTop: 4,
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#9CA3AF',
                    margin: '0 0 8px',
                  }}
                >
                  Preview
                </p>
                <p
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#111827',
                    letterSpacing: '0.06em',
                    margin: '0 0 6px',
                  }}
                >
                  {codePreview}
                </p>
                <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                  {countNum > 0 ? countNum : '?'} unique code{countNum !== 1 ? 's' : ''}{' '}
                  · {discountDisplay()} each · Single-use per person
                  {validUntil && ` · Expires ${formatPreviewDate(validUntil)}`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer (only shown in form state) */}
        {!result && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #E5E7EB',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 10,
                backgroundColor: submitting ? '#7DD3DA' : '#0FA3B1',
                color: 'white',
                border: 'none',
                fontSize: 15,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'background-color 150ms',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Generating…
                </>
              ) : (
                `Generate ${countNum > 0 ? countNum : ''} Code${countNum !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

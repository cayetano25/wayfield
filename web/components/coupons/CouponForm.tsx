'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Calendar,
  Check,
  DollarSign,
  Info,
  Loader2,
  Percent,
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ApiError } from '@/lib/api/client';
import {
  createCoupon,
  updateCoupon,
  type Coupon,
  type CreateCouponPayload,
} from '@/lib/api/coupons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormValues {
  code: string;
  label: string;
  description: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free';
  discount_pct: string;
  discount_amount: string; // dollars, converted to cents on submit
  applies_to: 'all' | 'workshop_only' | 'addons_only';
  minimum_order: string; // dollars
  max_redemptions: string;
  max_redemptions_per_user: string;
  is_active: boolean;
  valid_from: string;
  valid_until: string;
}

interface FieldErrors {
  code?: string;
  discount_pct?: string;
  discount_amount?: string;
  valid_until?: string;
  [key: string]: string | undefined;
}

interface CouponFormProps {
  organizationId: number;
  coupon?: Coupon;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIsoDate(dateStr: string): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr + 'T00:00:00').toISOString();
  } catch {
    return null;
  }
}

function fromIsoDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return iso.slice(0, 10);
  } catch {
    return '';
  }
}

function formatPreviewDiscount(values: FormValues): string {
  if (values.discount_type === 'free') return 'FREE';
  if (values.discount_type === 'percentage') {
    const n = parseFloat(values.discount_pct);
    return isNaN(n) || n <= 0 ? '?% off' : `${n}% off`;
  }
  const n = parseFloat(values.discount_amount);
  return isNaN(n) || n <= 0 ? '$?.?? off' : `$${n.toFixed(2)} off`;
}

function scopeLabel(s: FormValues['applies_to']): string {
  if (s === 'all') return 'All items';
  if (s === 'workshop_only') return 'Workshop registration only';
  return 'Add-on sessions only';
}

// ─── Deactivation confirmation modal ─────────────────────────────────────────

function DeactivationModal({
  code,
  onConfirm,
  onCancel,
}: {
  code: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
    >
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: '32px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <p
          style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: 17,
            fontWeight: 700,
            color: '#2E2E2E',
            margin: '0 0 12px',
          }}
        >
          Save changes and deactivate?
        </p>
        <p style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.6, margin: '0 0 8px' }}>
          You&apos;re saving{' '}
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              letterSpacing: '0.05em',
            }}
          >
            {code}
          </span>{' '}
          with <strong>Active</strong> turned off.
        </p>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 24px' }}>
          The coupon will stop accepting new redemptions immediately. You can reactivate it at
          any time.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 8,
              background: '#E94F37',
              color: 'white',
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}
          >
            Save & Deactivate
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 8,
              background: 'white',
              color: '#0FA3B1',
              border: '1px solid #0FA3B1',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontFamily: 'Sora, sans-serif',
        fontWeight: 700,
        fontSize: 13,
        color: '#111827',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        margin: '0 0 16px',
      }}
    >
      {children}
    </h3>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#374151',
        }}
      >
        {label}
        {required && <span style={{ color: '#E94F37', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error ? (
        <p
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            color: '#DC2626',
          }}
        >
          <AlertCircle size={12} />
          {error}
        </p>
      ) : hint ? (
        <p style={{ fontSize: 12, color: '#9CA3AF' }}>{hint}</p>
      ) : null}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  onBlur,
  placeholder,
  maxLength,
  disabled,
  hasError,
  mono,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  hasError?: boolean;
  mono?: boolean;
  type?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => { setFocused(false); onBlur?.(); }}
      onFocus={() => setFocused(true)}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      style={{
        height: 40,
        padding: '0 12px',
        border: `1px solid ${hasError ? '#F87171' : focused ? '#0FA3B1' : '#E5E7EB'}`,
        borderRadius: 10,
        fontSize: 14,
        color: '#111827',
        backgroundColor: disabled ? '#F9FAFB' : 'white',
        outline: 'none',
        transition: 'border-color 150ms',
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'Plus Jakarta Sans, sans-serif',
        letterSpacing: mono ? '0.06em' : undefined,
        boxShadow: focused ? `0 0 0 3px ${hasError ? 'rgba(248,113,113,0.15)' : 'rgba(15,163,177,0.1)'}` : 'none',
        width: '100%',
        boxSizing: 'border-box',
      }}
    />
  );
}

function NumberInput({
  value,
  onChange,
  onBlur,
  placeholder,
  min,
  max,
  step,
  prefix,
  suffix,
  hasError,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  hasError?: boolean;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      {prefix && (
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
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => { setFocused(false); onBlur?.(); }}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step ?? 1}
        disabled={disabled}
        style={{
          height: 40,
          width: '100%',
          paddingLeft: prefix ? 26 : 12,
          paddingRight: suffix ? 36 : 12,
          border: `1px solid ${hasError ? '#F87171' : focused ? '#0FA3B1' : '#E5E7EB'}`,
          borderRadius: 10,
          fontSize: 14,
          color: '#111827',
          backgroundColor: disabled ? '#F9FAFB' : 'white',
          outline: 'none',
          transition: 'border-color 150ms',
          boxShadow: focused ? `0 0 0 3px ${hasError ? 'rgba(248,113,113,0.15)' : 'rgba(15,163,177,0.1)'}` : 'none',
          boxSizing: 'border-box',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
      />
      {suffix && (
        <span
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 13,
            color: '#9CA3AF',
            pointerEvents: 'none',
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

// ─── Main form component ──────────────────────────────────────────────────────

export function CouponForm({ organizationId, coupon }: CouponFormProps) {
  const router = useRouter();
  const isEdit = !!coupon;
  const wasActive = coupon?.is_active ?? true;
  const isRedeemed = (coupon?.redemption_count ?? 0) > 0;

  const [values, setValues] = useState<FormValues>({
    code: coupon?.code ?? '',
    label: coupon?.label ?? '',
    description: coupon?.description ?? '',
    discount_type: coupon?.discount_type ?? 'percentage',
    discount_pct: coupon?.discount_pct != null ? String(coupon.discount_pct) : '',
    discount_amount: coupon?.discount_amount_cents != null
      ? (coupon.discount_amount_cents / 100).toFixed(2)
      : '',
    applies_to: coupon?.applies_to ?? 'all',
    minimum_order: coupon?.minimum_order_cents
      ? (coupon.minimum_order_cents / 100).toFixed(2)
      : '',
    max_redemptions: coupon?.max_redemptions != null ? String(coupon.max_redemptions) : '',
    max_redemptions_per_user: coupon?.max_redemptions_per_user != null
      ? String(coupon.max_redemptions_per_user)
      : '1',
    is_active: coupon?.is_active ?? true,
    valid_from: fromIsoDate(coupon?.valid_from ?? null),
    valid_until: fromIsoDate(coupon?.valid_until ?? null),
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const pendingSubmit = useRef(false);

  const set = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }, [errors]);

  const touch = useCallback((key: string) => {
    setTouched((t) => ({ ...t, [key]: true }));
  }, []);

  // Validate on touch
  useEffect(() => {
    const next: FieldErrors = {};
    if (touched.code && !values.code.trim()) {
      next.code = 'Code is required';
    } else if (touched.code && !/^[A-Z0-9-]+$/.test(values.code)) {
      next.code = 'Only uppercase letters, numbers, and hyphens';
    }
    if (touched.discount_pct && values.discount_type === 'percentage') {
      const n = parseFloat(values.discount_pct);
      if (isNaN(n) || n <= 0 || n > 100) next.discount_pct = 'Enter a value between 1 and 100';
    }
    if (touched.discount_amount && values.discount_type === 'fixed_amount') {
      const n = parseFloat(values.discount_amount);
      if (isNaN(n) || n <= 0) next.discount_amount = 'Enter a positive amount';
    }
    if (touched.valid_until && values.valid_until && values.valid_from && values.valid_until < values.valid_from) {
      next.valid_until = 'End date must be after start date';
    }
    setErrors(next);
  }, [values, touched]);

  function validate(): boolean {
    const allTouched: Record<string, boolean> = {
      code: true,
      discount_pct: values.discount_type === 'percentage',
      discount_amount: values.discount_type === 'fixed_amount',
      valid_until: true,
    };
    setTouched(allTouched);

    if (!values.code.trim()) return false;
    if (!/^[A-Z0-9-]+$/.test(values.code)) return false;
    if (values.discount_type === 'percentage') {
      const n = parseFloat(values.discount_pct);
      if (isNaN(n) || n <= 0 || n > 100) return false;
    }
    if (values.discount_type === 'fixed_amount') {
      const n = parseFloat(values.discount_amount);
      if (isNaN(n) || n <= 0) return false;
    }
    if (values.valid_until && values.valid_from && values.valid_until < values.valid_from) return false;
    return true;
  }

  function buildPayload(): CreateCouponPayload {
    const payload: CreateCouponPayload = {
      code: values.code.trim(),
      label: values.label.trim() || undefined,
      description: values.description.trim() || undefined,
      discount_type: values.discount_type,
      applies_to: values.applies_to,
      minimum_order_cents: values.minimum_order
        ? Math.round(parseFloat(values.minimum_order) * 100)
        : 0,
      max_redemptions: values.max_redemptions ? parseInt(values.max_redemptions) : null,
      max_redemptions_per_user: values.max_redemptions_per_user
        ? parseInt(values.max_redemptions_per_user)
        : 1,
      is_active: values.is_active,
      valid_from: toIsoDate(values.valid_from),
      valid_until: toIsoDate(values.valid_until),
    };

    if (values.discount_type === 'percentage') {
      payload.discount_pct = parseFloat(values.discount_pct);
    } else if (values.discount_type === 'fixed_amount') {
      payload.discount_amount_cents = Math.round(parseFloat(values.discount_amount) * 100);
    }

    return payload;
  }

  async function doSubmit() {
    const payload = buildPayload();
    try {
      setSubmitting(true);
      if (isEdit && coupon) {
        await updateCoupon(organizationId, coupon.id, payload);
        toast.success('Coupon updated');
      } else {
        await createCoupon(organizationId, payload);
        toast.success('Coupon created');
      }
      router.push('/organization/coupons');
    } catch (err) {
      if (err instanceof ApiError && err.errors) {
        const apiErrors: FieldErrors = {};
        for (const [field, messages] of Object.entries(err.errors)) {
          apiErrors[field] = messages[0];
        }
        setErrors(apiErrors);
      } else {
        toast.error(err instanceof ApiError ? err.message : 'Failed to save coupon');
      }
    } finally {
      setSubmitting(false);
      pendingSubmit.current = false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // Show deactivation warning if active is being turned off in edit mode
    if (isEdit && wasActive && !values.is_active) {
      setShowDeactivateModal(true);
      pendingSubmit.current = true;
      return;
    }

    await doSubmit();
  }

  function handleDeactivateConfirm() {
    setShowDeactivateModal(false);
    doSubmit();
  }

  const hasChanges = true; // simplification — form is always saveable

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {/* LEFT: form sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* SECTION: Basics */}
            <Card>
              <div style={{ padding: '24px' }}>
                <SectionHeading>Basics</SectionHeading>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <Field
                    label="Coupon Code"
                    required
                    error={errors.code}
                    hint="Letters, numbers, and hyphens only. Auto-uppercased."
                  >
                    <TextInput
                      value={values.code}
                      onChange={(v) => set('code', v.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                      onBlur={() => touch('code')}
                      placeholder="SUMMER20"
                      maxLength={50}
                      hasError={!!errors.code}
                      mono
                      disabled={isRedeemed}
                    />
                    {isRedeemed && (
                      <p style={{ fontSize: 12, color: '#92400E', backgroundColor: '#FFFBEB', padding: '6px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Info size={12} />
                        Code cannot be changed after first redemption.
                      </p>
                    )}
                  </Field>

                  <Field label="Label" hint="Internal name shown in the admin (optional).">
                    <TextInput
                      value={values.label}
                      onChange={(v) => set('label', v)}
                      placeholder="Summer 2026 promo"
                      maxLength={120}
                    />
                  </Field>

                  <Field label="Description" hint="Optional notes visible only to admins.">
                    <textarea
                      value={values.description}
                      onChange={(e) => set('description', e.target.value)}
                      placeholder="Created for the summer photography workshop series…"
                      maxLength={500}
                      rows={2}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid #E5E7EB',
                        borderRadius: 10,
                        fontSize: 14,
                        color: '#111827',
                        resize: 'vertical',
                        outline: 'none',
                        transition: 'border-color 150ms',
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = '#0FA3B1')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
                    />
                  </Field>
                </div>
              </div>
            </Card>

            {/* SECTION: Discount */}
            <Card>
              <div style={{ padding: '24px' }}>
                <SectionHeading>Discount</SectionHeading>

                {/* Segmented control */}
                <div
                  style={{
                    display: 'flex',
                    borderRadius: 10,
                    border: '1px solid #E5E7EB',
                    overflow: 'hidden',
                    marginBottom: 20,
                  }}
                >
                  {([
                    { value: 'percentage', label: '% Percentage', icon: Percent },
                    { value: 'fixed_amount', label: '$ Fixed Amount', icon: DollarSign },
                    { value: 'free', label: '✓ Free', icon: null },
                  ] as const).map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      disabled={isRedeemed}
                      onClick={() => set('discount_type', value)}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        fontSize: 13,
                        fontWeight: values.discount_type === value ? 700 : 500,
                        border: 'none',
                        backgroundColor: values.discount_type === value ? '#0FA3B1' : 'white',
                        color: values.discount_type === value ? 'white' : '#374151',
                        cursor: isRedeemed ? 'not-allowed' : 'pointer',
                        transition: 'all 150ms',
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 5,
                        opacity: isRedeemed ? 0.6 : 1,
                      }}
                    >
                      {Icon && <Icon size={13} />}
                      {label}
                    </button>
                  ))}
                </div>

                {values.discount_type === 'percentage' && (
                  <Field
                    label="Discount Percentage"
                    required
                    error={errors.discount_pct}
                  >
                    <NumberInput
                      value={values.discount_pct}
                      onChange={(v) => set('discount_pct', v)}
                      onBlur={() => touch('discount_pct')}
                      placeholder="20"
                      min={1}
                      max={100}
                      suffix="%"
                      hasError={!!errors.discount_pct}
                      disabled={isRedeemed}
                    />
                  </Field>
                )}

                {values.discount_type === 'fixed_amount' && (
                  <Field
                    label="Discount Amount"
                    required
                    error={errors.discount_amount}
                  >
                    <NumberInput
                      value={values.discount_amount}
                      onChange={(v) => set('discount_amount', v)}
                      onBlur={() => touch('discount_amount')}
                      placeholder="40.00"
                      min={0.01}
                      step={0.01}
                      prefix="$"
                      hasError={!!errors.discount_amount}
                      disabled={isRedeemed}
                    />
                  </Field>
                )}

                {values.discount_type === 'free' && (
                  <div
                    style={{
                      padding: '14px 16px',
                      backgroundColor: '#F0FDFF',
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Check size={16} color="#0FA3B1" />
                    <p style={{ fontSize: 14, color: '#0FA3B1', fontWeight: 600, margin: 0 }}>
                      This coupon makes the entire order free.
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* SECTION: Restrictions */}
            <Card>
              <div style={{ padding: '24px' }}>
                <SectionHeading>Restrictions</SectionHeading>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <Field label="Applies To">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {([
                        { value: 'all', label: 'All items', hint: 'Registration + all add-ons' },
                        { value: 'workshop_only', label: 'Workshop registration only', hint: 'Discounts the base registration fee' },
                        { value: 'addons_only', label: 'Add-on sessions only', hint: 'Discounts only session add-ons' },
                      ] as const).map(({ value, label, hint }) => (
                        <label
                          key={value}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: `1px solid ${values.applies_to === value ? '#0FA3B1' : '#E5E7EB'}`,
                            cursor: 'pointer',
                            backgroundColor: values.applies_to === value ? '#F0FDFF' : 'white',
                            transition: 'all 150ms',
                          }}
                        >
                          <input
                            type="radio"
                            name="applies_to"
                            value={value}
                            checked={values.applies_to === value}
                            onChange={() => set('applies_to', value)}
                            style={{ marginTop: 2, accentColor: '#0FA3B1' }}
                          />
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
                              {label}
                            </p>
                            <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>
                              {hint}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </Field>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Field
                      label="Min. Order Total"
                      hint="The coupon only applies when the cart subtotal is at least this amount. For workshops using deposit payment, the subtotal is the full workshop price — not the deposit amount. For example, a $100 minimum on a $200 workshop with a $75 deposit still qualifies (the full price is $200, above the minimum)."
                    >
                      <NumberInput
                        value={values.minimum_order}
                        onChange={(v) => set('minimum_order', v)}
                        placeholder="0.00"
                        min={0}
                        step={0.01}
                        prefix="$"
                      />
                    </Field>

                    <Field label="Max Total Uses" hint="Leave blank for unlimited.">
                      <NumberInput
                        value={values.max_redemptions}
                        onChange={(v) => set('max_redemptions', v)}
                        placeholder="Unlimited"
                        min={1}
                      />
                    </Field>
                  </div>

                  <Field
                    label="Max Uses Per Participant"
                    hint="How many times one participant can use this code."
                  >
                    <NumberInput
                      value={values.max_redemptions_per_user}
                      onChange={(v) => set('max_redemptions_per_user', v)}
                      placeholder="1"
                      min={1}
                    />
                  </Field>
                </div>
              </div>
            </Card>

            {/* SECTION: Validity */}
            <Card>
              <div style={{ padding: '24px' }}>
                <SectionHeading>Validity</SectionHeading>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Active toggle */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: 10,
                      border: `1px solid ${values.is_active ? '#86EFAC' : '#E5E7EB'}`,
                      backgroundColor: values.is_active ? '#F0FDF4' : '#FAFAFA',
                      transition: 'all 150ms',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
                        Active
                      </p>
                      <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>
                        {values.is_active
                          ? 'Coupon is accepting redemptions'
                          : 'Coupon will not accept redemptions'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => set('is_active', !values.is_active)}
                      role="switch"
                      aria-checked={values.is_active}
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: values.is_active ? '#16A34A' : '#D1D5DB',
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background-color 200ms',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 3,
                          left: values.is_active ? 23 : 3,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          backgroundColor: 'white',
                          transition: 'left 200ms',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }}
                      />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Field label="Valid From" hint="Leave blank to be valid immediately.">
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
                          value={values.valid_from}
                          onChange={(e) => set('valid_from', e.target.value)}
                          style={{
                            height: 40,
                            width: '100%',
                            paddingLeft: 34,
                            paddingRight: 12,
                            border: '1px solid #E5E7EB',
                            borderRadius: 10,
                            fontSize: 14,
                            color: '#111827',
                            outline: 'none',
                            boxSizing: 'border-box',
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                          }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = '#0FA3B1')}
                          onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
                        />
                      </div>
                    </Field>

                    <Field
                      label="Valid Until"
                      hint="Leave blank to never expire."
                      error={errors.valid_until}
                    >
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
                          value={values.valid_until}
                          onChange={(e) => { set('valid_until', e.target.value); touch('valid_until'); }}
                          style={{
                            height: 40,
                            width: '100%',
                            paddingLeft: 34,
                            paddingRight: 12,
                            border: `1px solid ${errors.valid_until ? '#F87171' : '#E5E7EB'}`,
                            borderRadius: 10,
                            fontSize: 14,
                            color: '#111827',
                            outline: 'none',
                            boxSizing: 'border-box',
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                          }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = errors.valid_until ? '#F87171' : '#0FA3B1')}
                          onBlur={(e) => (e.currentTarget.style.borderColor = errors.valid_until ? '#F87171' : '#E5E7EB')}
                        />
                      </div>
                    </Field>
                  </div>
                </div>
              </div>
            </Card>

            {/* Action bar */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push('/organization/coupons')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitting} disabled={!hasChanges}>
                {submitting ? (
                  <>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Saving…
                  </>
                ) : isEdit ? 'Save Changes' : 'Create Coupon'}
              </Button>
            </div>
          </div>

          {/* RIGHT: preview card (sticky) */}
          <div style={{ position: 'sticky', top: 24 }}>
            <Card>
              <div style={{ padding: '20px' }}>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#9CA3AF',
                    margin: '0 0 16px',
                  }}
                >
                  Preview
                </p>

                {/* Code display */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 12,
                    backgroundColor: '#F0FDFF',
                    border: '1px dashed #0FA3B1',
                    marginBottom: 16,
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    <Tag size={14} color="#0FA3B1" />
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        fontSize: 18,
                        color: '#0FA3B1',
                        letterSpacing: '0.1em',
                      }}
                    >
                      {values.code || 'YOURCODE'}
                    </span>
                  </div>
                  <p
                    style={{
                      fontFamily: 'Sora, sans-serif',
                      fontWeight: 700,
                      fontSize: 22,
                      color: '#111827',
                      margin: 0,
                    }}
                  >
                    {formatPreviewDiscount(values)}
                  </p>
                </div>

                {/* Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <PreviewRow label="Applies to" value={scopeLabel(values.applies_to)} />
                  {values.minimum_order && parseFloat(values.minimum_order) > 0 && (
                    <PreviewRow
                      label="Min. order"
                      value={`$${parseFloat(values.minimum_order).toFixed(2)}`}
                    />
                  )}
                  {values.max_redemptions && (
                    <PreviewRow label="Max uses" value={values.max_redemptions} />
                  )}
                  <PreviewRow
                    label="Per participant"
                    value={`${values.max_redemptions_per_user || 1} use${(values.max_redemptions_per_user || '1') !== '1' ? 's' : ''}`}
                  />
                  {values.valid_from && (
                    <PreviewRow
                      label="Starts"
                      value={new Date(values.valid_from + 'T12:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    />
                  )}
                  {values.valid_until && (
                    <PreviewRow
                      label="Expires"
                      value={new Date(values.valid_until + 'T12:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    />
                  )}
                  <PreviewRow
                    label="Status"
                    value={
                      values.is_active
                        ? !values.valid_from || new Date(values.valid_from + 'T00:00:00') <= new Date()
                          ? 'Active'
                          : 'Scheduled'
                        : 'Inactive'
                    }
                    highlight={values.is_active}
                  />
                </div>

                {/* Redemption stats for edit mode */}
                {isEdit && coupon && coupon.redemption_count > 0 && (
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 16,
                      borderTop: '1px solid #F3F4F6',
                    }}
                  >
                    <p style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                      Usage
                    </p>
                    <PreviewRow label="Total uses" value={String(coupon.redemption_count)} />
                    <PreviewRow label="Total saved" value={coupon.total_discount_given_formatted} />
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </form>

      {showDeactivateModal && (
        <DeactivationModal
          code={values.code}
          onConfirm={handleDeactivateConfirm}
          onCancel={() => setShowDeactivateModal(false)}
        />
      )}
    </>
  );
}

function PreviewRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 13,
      }}
    >
      <span style={{ color: '#6B7280' }}>{label}</span>
      <span
        style={{
          fontWeight: 600,
          color: highlight ? '#16A34A' : '#111827',
        }}
      >
        {value}
      </span>
    </div>
  );
}

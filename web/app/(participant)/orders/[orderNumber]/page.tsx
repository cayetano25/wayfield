'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle,
  Calendar,
  CreditCard,
  ArrowRight,
  Loader2,
  AlertCircle,
  ShoppingBag,
  Clock,
  X,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getOrder, type OrderSummary } from '@/lib/api/cart';
import {
  createRefundRequest,
  getOrderRefundRequests,
  REASON_CODES,
  type RefundRequest,
  type RefundReasonCode,
} from '@/lib/api/refunds';
import { formatCents } from '@/lib/utils/currency';
import { ApiError } from '@/lib/api/client';

/* ─── Sub-components (unchanged from before) ──────────────────────────── */

function SuccessAnimation() {
  return (
    <div
      style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        backgroundColor: '#DCFCE7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        animation: 'bounceOnce 600ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}
    >
      <CheckCircle size={40} color="#16A34A" strokeWidth={2} />
    </div>
  );
}

function OrderItemRow({ item }: { item: OrderSummary['items'][number] }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid #F3F4F6',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: '#F0FDFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <ShoppingBag size={16} color="#0FA3B1" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: '#111827',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.workshop_title ?? item.session_title ?? 'Item'}
        </p>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
          {item.item_type === 'addon_session' ? 'Add-on session' : 'Workshop registration'}
        </p>
        {item.is_tier_price && item.applied_tier_label && (
          <span
            style={{
              fontSize: 12,
              color: '#16A34A',
              fontWeight: 500,
              marginTop: 4,
              display: 'inline-block',
            }}
          >
            {item.applied_tier_label} pricing applied
          </span>
        )}
        {item.is_deposit && item.balance_due_date && (
          <p
            style={{
              fontSize: 11,
              color: '#92400E',
              marginTop: 4,
              backgroundColor: '#FFFBEB',
              borderRadius: 4,
              padding: '2px 6px',
              display: 'inline-block',
            }}
          >
            Deposit paid · Balance due{' '}
            {new Date(item.balance_due_date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
      <span style={{ fontWeight: 700, fontSize: 14, color: '#111827', whiteSpace: 'nowrap' }}>
        {item.line_total_cents === 0 ? 'Free' : formatCents(item.line_total_cents)}
      </span>
    </div>
  );
}

function WhatsNextCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '14px 0',
        borderBottom: '1px solid #F3F4F6',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: '#F0FDFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontWeight: 600, fontSize: 14, color: '#111827', margin: 0 }}>{title}</p>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '3px 0 0', lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
    </div>
  );
}

/* ─── Refund request modal ─────────────────────────────────────────────── */

type RefundStep = 'form' | 'success' | 'closed';

function RefundModal({
  open,
  order,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  order: OrderSummary;
  onClose: () => void;
  onSubmitted: (req: RefundRequest) => void;
}) {
  const [step, setStep] = useState<RefundStep>('form');
  const [reasonCode, setReasonCode] = useState<RefundReasonCode | ''>('');
  const [reasonText, setReasonText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedReq, setSubmittedReq] = useState<RefundRequest | null>(null);

  useEffect(() => {
    if (open) {
      setStep('form');
      setReasonCode('');
      setReasonText('');
      setErrorMsg(null);
      setSubmittedReq(null);
    }
  }, [open]);

  async function handleSubmit() {
    if (!reasonCode) {
      setErrorMsg('Please select a reason.');
      return;
    }
    if (reasonCode === 'other' && !reasonText.trim()) {
      setErrorMsg('Please describe your reason.');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const req = await createRefundRequest(order.order_number, {
        reason_code: reasonCode,
        reason_text: reasonText.trim() || undefined,
        requested_amount_cents: order.total_cents,
      });
      setSubmittedReq(req);
      setStep('success');
      onSubmitted(req);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const body = err.message ?? '';
        if (body.includes('commitment') || body.includes('commitment_date_passed')) {
          setErrorMsg(
            'Refunds are no longer available for this workshop due to committed logistics costs.',
          );
        } else if (body.includes('already pending')) {
          setErrorMsg('A refund request for this order is already pending organizer review.');
        } else {
          setErrorMsg(err.message || 'Could not submit refund request.');
        }
      } else {
        setErrorMsg('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  if (!open) return null;

  const isOther = reasonCode === 'other';
  const autoEligible = submittedReq?.auto_eligible ?? false;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Overlay */}
      <div
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(46,46,46,0.4)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#ffffff',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(46,46,46,0.18)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 20px 0',
          }}
        >
          <h2
            style={{
              fontFamily: 'Sora, sans-serif',
              fontWeight: 700,
              fontSize: 18,
              color: '#111827',
              margin: 0,
            }}
          >
            {step === 'success' ? (autoEligible ? 'Refund Approved' : 'Request Submitted') : 'Request a Refund'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: 6,
              borderRadius: 8,
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: '#9CA3AF',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* ── FORM STEP ── */}
          {step === 'form' && (
            <>
              {/* Amount display */}
              <div
                style={{
                  borderRadius: 12,
                  backgroundColor: '#F9FAFB',
                  padding: '16px',
                  textAlign: 'center',
                  marginBottom: 20,
                }}
              >
                <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 4px' }}>You&apos;ll receive</p>
                <p
                  style={{
                    fontFamily: 'Sora, sans-serif',
                    fontWeight: 700,
                    fontSize: 32,
                    color: '#111827',
                    margin: '0 0 4px',
                  }}
                >
                  {formatCents(order.total_cents)}
                </p>
                <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                  Pending organizer review
                </p>
              </div>

              {/* Reason selector */}
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 6,
                  }}
                >
                  Reason <span style={{ color: '#E94F37' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={reasonCode}
                    onChange={(e) => {
                      setReasonCode(e.target.value as RefundReasonCode | '');
                      setErrorMsg(null);
                    }}
                    style={{
                      width: '100%',
                      height: 42,
                      paddingLeft: 12,
                      paddingRight: 32,
                      fontSize: 14,
                      color: reasonCode ? '#111827' : '#9CA3AF',
                      backgroundColor: '#ffffff',
                      border: '1px solid #E5E7EB',
                      borderRadius: 10,
                      appearance: 'none',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Select a reason…</option>
                    {REASON_CODES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    color="#9CA3AF"
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  />
                </div>
              </div>

              {/* Optional reason text */}
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 6,
                  }}
                >
                  Additional details{' '}
                  <span style={{ fontWeight: 400, color: '#9CA3AF' }}>
                    {isOther ? '(required)' : '(optional)'}
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={reasonText}
                  onChange={(e) => {
                    setReasonText(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="Share any additional context…"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 14,
                    color: '#111827',
                    backgroundColor: '#ffffff',
                    border: '1px solid #E5E7EB',
                    borderRadius: 10,
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                  }}
                />
              </div>

              {/* Error */}
              {errorMsg && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    backgroundColor: '#FEF2F2',
                    borderRadius: 10,
                    padding: '10px 12px',
                    marginBottom: 16,
                  }}
                >
                  <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 13, color: '#DC2626', margin: 0, lineHeight: 1.5 }}>
                    {errorMsg}
                  </p>
                </div>
              )}

              {/* Policy reminder */}
              <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 20px', lineHeight: 1.6 }}>
                Refund eligibility is determined per the workshop&apos;s refund policy. Once submitted,
                the organizer will review your request and you&apos;ll receive an email with their decision.
              </p>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    border: '1px solid #E5E7EB',
                    backgroundColor: '#F9FAFB',
                    color: '#374151',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    border: 'none',
                    backgroundColor: submitting ? '#9CA3AF' : '#0FA3B1',
                    color: '#ffffff',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {submitting ? (
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </div>
            </>
          )}

          {/* ── SUCCESS STEP ── */}
          {step === 'success' && submittedReq && (
            <>
              <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    backgroundColor: autoEligible ? '#DCFCE7' : '#F0FDFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  {autoEligible
                    ? <CheckCircle size={32} color="#16A34A" />
                    : <Clock size={32} color="#0FA3B1" />
                  }
                </div>

                {autoEligible ? (
                  <>
                    <p
                      style={{
                        fontFamily: 'Sora, sans-serif',
                        fontWeight: 700,
                        fontSize: 20,
                        color: '#111827',
                        margin: '0 0 8px',
                      }}
                    >
                      Refund approved
                    </p>
                    <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
                      Your refund of{' '}
                      <strong style={{ color: '#111827' }}>
                        {formatCents(submittedReq.requested_amount_cents)}
                      </strong>{' '}
                      has been approved and submitted to your bank. Allow{' '}
                      <strong style={{ color: '#111827' }}>3–5 business days</strong>.
                    </p>
                  </>
                ) : (
                  <>
                    <p
                      style={{
                        fontFamily: 'Sora, sans-serif',
                        fontWeight: 700,
                        fontSize: 20,
                        color: '#111827',
                        margin: '0 0 8px',
                      }}
                    >
                      Request submitted
                    </p>
                    <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>
                      Your request has been submitted. The organizer will review it and you&apos;ll
                      be notified of their decision by email.
                    </p>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 12,
                  border: 'none',
                  backgroundColor: '#0FA3B1',
                  color: '#ffffff',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Existing refund request status banner ───────────────────────────── */

function RefundStatusBanner({ requests }: { requests: RefundRequest[] }) {
  if (requests.length === 0) return null;

  const latest = requests[0];
  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    pending:      { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
    auto_approved:{ bg: '#F0FDF4', text: '#14532D', border: '#BBF7D0' },
    approved:     { bg: '#F0FDF4', text: '#14532D', border: '#BBF7D0' },
    denied:       { bg: '#FEF2F2', text: '#7F1D1D', border: '#FECACA' },
  };
  const colors = statusColors[latest.status] ?? statusColors['pending'];
  const statusLabel: Record<string, string> = {
    pending: 'Pending organizer review',
    auto_approved: 'Refund approved',
    approved: 'Refund approved',
    denied: 'Refund denied',
  };

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.bg,
        padding: '12px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <RotateCcw size={16} color={colors.text} style={{ flexShrink: 0 }} />
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: colors.text, margin: 0 }}>
          {statusLabel[latest.status] ?? 'Refund request'}
        </p>
        {latest.status === 'pending' && (
          <p style={{ fontSize: 12, color: colors.text, margin: '2px 0 0', opacity: 0.8 }}>
            {formatCents(latest.requested_amount_cents)} requested ·{' '}
            {new Date(latest.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        {(latest.status === 'approved' || latest.status === 'auto_approved') && (
          <p style={{ fontSize: 12, color: colors.text, margin: '2px 0 0', opacity: 0.8 }}>
            {formatCents(latest.approved_amount_cents ?? latest.requested_amount_cents)} · Allow 3–5 business days
          </p>
        )}
        {latest.status === 'denied' && latest.review_notes && (
          <p style={{ fontSize: 12, color: colors.text, margin: '2px 0 0', opacity: 0.8 }}>
            {latest.review_notes}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────────────────────── */

export default function OrderConfirmationPage() {
  const params = useParams();
  const orderNumber = params.orderNumber as string;

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [existingRequests, setExistingRequests] = useState<RefundRequest[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      try {
        const [data, requests] = await Promise.all([
          getOrder(orderNumber),
          getOrderRefundRequests(orderNumber).catch(() => [] as RefundRequest[]),
        ]);
        if (!cancelled) {
          setOrder(data);
          setExistingRequests(requests);
        }
      } catch {
        if (!cancelled) setError('Order not found. Please check your email for confirmation.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader2 size={32} color="#0FA3B1" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: '64px auto',
          padding: '0 16px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: '#FEF2F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <AlertCircle size={32} color="#DC2626" />
        </div>
        <h1
          style={{
            fontFamily: 'Sora, sans-serif',
            fontWeight: 700,
            fontSize: 22,
            color: '#111827',
            margin: '0 0 8px',
          }}
        >
          Order not found
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px', lineHeight: 1.6 }}>
          {error ?? 'We could not load your order details.'}
        </p>
        <Link
          href="/my-workshops"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            borderRadius: 10,
            backgroundColor: '#0FA3B1',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Go to My Workshops
        </Link>
      </div>
    );
  }

  const hasDeposit = order.is_deposit_order && order.balance_due_date != null;
  const hasVirtual = order.items.some((i) => i.item_type === 'addon_session');

  const canRequestRefund =
    (order.status === 'completed' || order.status === 'partially_refunded') &&
    order.total_cents > 0 &&
    !existingRequests.some((r) => r.status === 'pending');

  const hasPendingRequest = existingRequests.some((r) => r.status === 'pending');

  function handleRefundSubmitted(req: RefundRequest) {
    setExistingRequests((prev) => [req, ...prev]);
  }

  return (
    <>
      <style>{`
        @keyframes bounceOnce {
          0%   { transform: scale(0.5); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          80%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div
        style={{
          maxWidth: 520,
          margin: '0 auto',
          padding: '48px 16px 80px',
        }}
      >
        {/* Success hero */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <SuccessAnimation />
          <h1
            style={{
              fontFamily: 'Sora, sans-serif',
              fontWeight: 700,
              fontSize: 26,
              color: '#111827',
              margin: '0 0 8px',
            }}
          >
            You&apos;re registered!
          </h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: '0 0 6px', lineHeight: 1.6 }}>
            Order <strong style={{ color: '#111827' }}>{order.order_number}</strong> is confirmed.
          </p>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
            A confirmation email is on its way to you.
          </p>
        </div>

        {/* Existing refund request status */}
        <RefundStatusBanner requests={existingRequests} />

        {/* Order summary card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: '20px 20px 4px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontFamily: 'Sora, sans-serif',
              fontWeight: 700,
              fontSize: 11,
              color: '#9CA3AF',
              margin: '0 0 4px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Order Summary
          </h2>

          {order.items.map((item) => (
            <OrderItemRow key={item.id} item={item} />
          ))}

          {/* Totals */}
          <div style={{ padding: '12px 0 8px' }}>
            {order.subtotal_cents !== order.total_cents && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: '#6B7280',
                  marginBottom: 6,
                }}
              >
                <span>Subtotal</span>
                <span>{formatCents(order.subtotal_cents)}</span>
              </div>
            )}
            {(order.wayfield_fee_cents > 0 || order.stripe_fee_cents > 0) && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: '#6B7280',
                  marginBottom: 6,
                }}
              >
                <span>Processing fee</span>
                <span>{formatCents(order.wayfield_fee_cents + order.stripe_fee_cents)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 15,
                fontWeight: 700,
                color: '#111827',
                paddingTop: 10,
                borderTop: '1px solid #E5E7EB',
              }}
            >
              <span>{hasDeposit ? 'Deposit paid today' : 'Total paid'}</span>
              <span>{order.total_cents === 0 ? 'Free' : formatCents(order.total_cents)}</span>
            </div>
            {hasDeposit && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: '#92400E',
                  marginTop: 6,
                  backgroundColor: '#FFFBEB',
                  borderRadius: 6,
                  padding: '6px 8px',
                }}
              >
                <span>Balance due</span>
                <span>
                  {new Date(order.balance_due_date!).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Payment method badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#F9FAFB',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 24,
            fontSize: 12,
            color: '#6B7280',
          }}
        >
          <CreditCard size={14} color="#9CA3AF" />
          <span>
            {order.payment_method === 'stripe'
              ? 'Paid by card'
              : order.payment_method === 'free'
                ? 'No payment required'
                : order.payment_method}
          </span>
          <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>
            {order.completed_at
              ? new Date(order.completed_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : new Date(order.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
          </span>
        </div>

        {/* What's next card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: '20px 20px 4px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            marginBottom: 32,
          }}
        >
          <h2
            style={{
              fontFamily: 'Sora, sans-serif',
              fontWeight: 700,
              fontSize: 11,
              color: '#9CA3AF',
              margin: '0 0 4px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            What&apos;s next
          </h2>

          <WhatsNextCard
            icon={<Calendar size={16} color="#0FA3B1" />}
            title="Check your schedule"
            description="Your sessions are now confirmed. Visit My Workshops to view your schedule and select any optional sessions."
          />

          {hasDeposit && (
            <WhatsNextCard
              icon={<Clock size={16} color="#D97706" />}
              title="Balance payment reminder"
              description={`Your remaining balance is due by ${new Date(order.balance_due_date!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. You'll receive a reminder email before the deadline.`}
            />
          )}

          {hasVirtual && (
            <WhatsNextCard
              icon={<CheckCircle size={16} color="#0FA3B1" />}
              title="Virtual session access"
              description="Join links for online sessions become available when you open each session in My Workshops."
            />
          )}

          <WhatsNextCard
            icon={<ShoppingBag size={16} color="#0FA3B1" />}
            title="Confirmation email"
            description="We've sent a receipt and registration details to your email address."
          />
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link
            href="/my-workshops"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '14px 0',
              borderRadius: 12,
              backgroundColor: '#0FA3B1',
              color: '#ffffff',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            View My Workshops
            <ArrowRight size={16} />
          </Link>

          <Link
            href="/discover"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '13px 0',
              borderRadius: 12,
              backgroundColor: '#F9FAFB',
              color: '#374151',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
              border: '1px solid #E5E7EB',
              textAlign: 'center',
            }}
          >
            Browse More Workshops
          </Link>

          {/* Request Refund */}
          {canRequestRefund && (
            <button
              type="button"
              onClick={() => setRefundModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                padding: '11px 0',
                borderRadius: 12,
                backgroundColor: 'transparent',
                color: '#6B7280',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontWeight: 500,
                fontSize: 13,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={13} />
              Request a refund
            </button>
          )}

          {hasPendingRequest && !canRequestRefund && (
            <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', margin: '4px 0 0' }}>
              A refund request is pending organizer review.
            </p>
          )}
        </div>
      </div>

      {/* Refund modal */}
      {order && (
        <RefundModal
          open={refundModalOpen}
          order={order}
          onClose={() => setRefundModalOpen(false)}
          onSubmitted={handleRefundSubmitted}
        />
      )}
    </>
  );
}

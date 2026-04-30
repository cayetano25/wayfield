'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Mail,
} from 'lucide-react';
import { getOrderDetail } from '@/lib/api/orders';
import { getToken } from '@/lib/auth/session';
import { apiPost } from '@/lib/api/client';
import { PaymentStatusBadge } from '@/components/workshops/pricing/PaymentStatusBadge';
import type { PaymentStatus } from '@/components/workshops/pricing/PaymentStatusBadge';
import { useUser } from '@/contexts/UserContext';
import toast from 'react-hot-toast';
import type { OrderHistoryDetail } from '@/lib/types/orders';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

const KNOWN_STATUSES: readonly PaymentStatus[] = [
  'Free',
  'Deposit Paid',
  'Fully Paid',
  'Balance Due',
  'Payment Pending',
] as const;

function isKnownPaymentStatus(s: string): s is PaymentStatus {
  return (KNOWN_STATUSES as readonly string[]).includes(s);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCents(cents: number): string {
  return `$${(Math.round(cents) / 100).toFixed(2)}`;
}

async function downloadReceiptFile(orderNumber: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/me/orders/${orderNumber}/receipt`, {
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
      Accept: 'application/pdf',
    },
  });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `receipt-${orderNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* --- Refund status icon ------------------------------------------------- */

function RefundIcon({ status }: { status: string }) {
  if (status === 'approved' || status === 'auto_approved') {
    return <CheckCircle size={14} className="text-green-600 shrink-0" />;
  }
  if (status === 'pending') {
    return <Clock size={14} className="text-amber-500 shrink-0" />;
  }
  return <AlertCircle size={14} className="text-red-500 shrink-0" />;
}

/* --- Page --------------------------------------------------------------- */

export default function ReceiptDetailPage() {
  const params = useParams();
  const orderNumber = params.orderNumber as string;
  const { user } = useUser();

  const [order, setOrder] = useState<OrderHistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    getOrderDetail(orderNumber)
      .then(setOrder)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [orderNumber]);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadReceiptFile(orderNumber);
    } catch {
      toast.error('Could not download receipt. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  async function handleResendEmail() {
    setResendLoading(true);
    try {
      await apiPost(`/me/orders/${orderNumber}/resend-receipt`);
      setResendSent(true);
    } catch {
      toast.error('Could not send receipt email. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }

  /* --- Loading ---------------------------------------------------------- */

  if (loading) {
    return (
      <>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 size={32} color="#0FA3B1" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      </>
    );
  }

  /* --- Error ------------------------------------------------------------ */

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={28} color="#E94F37" />
        </div>
        <h1 className="font-heading font-bold text-xl text-gray-900 mb-2">Receipt not found</h1>
        <p className="text-sm text-gray-500 mb-6">
          We could not load this receipt. It may not exist or you may not have access to it.
        </p>
        <Link href="/account/receipts" className="text-sm font-semibold text-[#0FA3B1] hover:underline">
          ← Back to Receipts
        </Link>
      </div>
    );
  }

  /* --- Computed values -------------------------------------------------- */

  const subtotalCents = order.subtotal_cents ?? 0;
  const discountCents = order.discount_cents ?? 0;
  const totalFeesCents = (order.wayfield_fee_cents ?? 0) + (order.stripe_fee_cents ?? 0);
  const balanceCents = order.balance_amount_cents ?? 0;
  const hasDiscount = discountCents > 0 && !!order.coupon;
  const hasFees = totalFeesCents > 0;
  const canDownload = order.status === 'completed' || order.status.includes('refunded');
  const userEmail = user?.email ?? '';

  /* --- Render ----------------------------------------------------------- */

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 pb-16">

      {/* ── SECTION 1: Header card ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">

        {/* Organization info */}
        <p className="text-xs text-gray-400 font-mono mb-1">{order.order_number}</p>
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          {order.organization?.name ?? 'Receipt'}
        </h1>
        <p className="text-sm text-gray-500">
          {formatDate(order.completed_at)} · {order.status_label}
        </p>

        {/* Amount + badge */}
        <div className="mt-4 flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl font-bold text-gray-900">{order.total}</span>
          {isKnownPaymentStatus(order.status_label) ? (
            <PaymentStatusBadge status={order.status_label} />
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600">
              {order.status_label}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!canDownload || downloading}
            className="flex-1 flex items-center justify-center gap-2 bg-[#0FA3B1] hover:bg-[#0c8a96] text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {downloading
              ? <Loader2 size={16} className="animate-spin" />
              : <Download size={16} />
            }
            {downloading ? 'Downloading…' : 'Download PDF Receipt'}
          </button>

          <button
            type="button"
            onClick={handleResendEmail}
            disabled={resendSent || resendLoading}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 font-medium px-4 py-3 rounded-xl text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {resendLoading
              ? <Loader2 size={14} className="animate-spin" />
              : <Mail size={14} />
            }
            {resendSent ? 'Sent!' : 'Email Receipt'}
          </button>
        </div>

        {resendSent && userEmail && (
          <p className="text-xs text-green-600 text-center mt-2">
            Receipt sent to {userEmail}
          </p>
        )}
      </div>

      {/* ── SECTION 2: Items ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-gray-100">
          <p
            className="font-mono font-semibold uppercase tracking-wide"
            style={{ fontSize: 11, color: '#9CA3AF' }}
          >
            Items
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {order.items.map((item) => (
            <div key={item.id} className="px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {item.workshop_title ?? item.session_title ?? item.item_type_label}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                  <span className="text-xs text-gray-500">{item.item_type_label}</span>
                  {item.applied_tier_label && (
                    <span className="text-xs text-[#0FA3B1] font-medium">
                      · {item.applied_tier_label} pricing
                    </span>
                  )}
                  {item.is_deposit && (
                    <span className="text-xs text-amber-600 font-medium">· Deposit</span>
                  )}
                </div>
                {item.workshop_dates && (
                  <p className="text-xs text-gray-400 mt-0.5">{item.workshop_dates}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-semibold text-gray-900">{item.line_total}</span>
                {item.refunded_amount && (
                  <p className="text-xs text-green-600 mt-0.5">
                    Refunded: {item.refunded_amount}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 3: Payment breakdown ───────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Payment Breakdown</h2>

        <div className="space-y-2 text-sm">
          {subtotalCents > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-900">{formatCents(subtotalCents)}</span>
            </div>
          )}

          {hasDiscount && order.coupon && (
            <div className="flex justify-between text-green-600">
              <span>Coupon ({order.coupon.code})</span>
              <span>− {order.coupon.discount_display}</span>
            </div>
          )}

          {hasFees && (
            <div className="flex justify-between">
              <span className="text-gray-500">Processing fee</span>
              <span className="text-gray-900">{formatCents(totalFeesCents)}</span>
            </div>
          )}

          {order.is_deposit_order && (
            <>
              <div className="flex justify-between text-amber-700">
                <span>Deposit paid</span>
                <span>{order.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">
                  Balance{' '}
                  {order.balance_paid_at
                    ? 'paid'
                    : `due ${formatDate(order.balance_due_date)}`}
                </span>
                <span className="text-gray-900">
                  {balanceCents > 0 ? formatCents(balanceCents) : '—'}
                </span>
              </div>
            </>
          )}

          <div className="flex justify-between font-semibold text-gray-900 pt-2 border-t border-gray-100">
            <span>Total paid</span>
            <span>{order.total}</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: Refunds ─────────────────────────────────────────── */}
      {order.refund_requests.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-5">
          <div className="px-5 py-3 border-b border-gray-100">
            <p
              className="font-mono font-semibold uppercase tracking-wide"
              style={{ fontSize: 11, color: '#9CA3AF' }}
            >
              Refunds
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {order.refund_requests.map((req) => (
              <div key={req.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <RefundIcon status={req.status} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {req.status.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {req.processed_at ? formatDate(req.processed_at) : formatDate(req.created_at)}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-700 shrink-0">
                  {req.approved_amount ?? req.requested_amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 5: Tax notice ──────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 mb-5">
        <p className="font-medium text-gray-700 mb-1">For tax purposes</p>
        <p>
          This receipt documents a payment for a professional development workshop. The
          downloaded PDF receipt is suitable for expense reimbursement and tax deduction
          claims. Consult your tax advisor to confirm deductibility.
        </p>
      </div>

      {/* ── SECTION 6: Back link ───────────────────────────────────────── */}
      <Link
        href="/account/receipts"
        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 mt-4"
      >
        ← Back to all receipts
      </Link>
    </div>
  );
}

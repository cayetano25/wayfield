'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, Download, Receipt, AlertCircle } from 'lucide-react';
import { getOrderHistory } from '@/lib/api/orders';
import { getToken } from '@/lib/auth/session';
import { PaymentStatusBadge } from '@/components/workshops/pricing/PaymentStatusBadge';
import type { PaymentStatus } from '@/components/workshops/pricing/PaymentStatusBadge';
import type { OrderHistoryResponse, OrderHistoryEntry } from '@/lib/types/orders';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, 'All'] as const;
type YearFilter = (typeof YEAR_OPTIONS)[number];

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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

/* --- Skeleton ----------------------------------------------------------- */

function Skeleton({ height, className = '' }: { height: number; className?: string }) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        height,
        background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
        backgroundSize: '400% 100%',
        animation: 'receiptsShimmer 1.4s infinite',
      }}
    />
  );
}

/* --- Order card --------------------------------------------------------- */

function OrderCard({ order }: { order: OrderHistoryEntry }) {
  const [downloading, setDownloading] = useState(false);
  const canDownload = order.status === 'completed' || order.status.includes('refunded');

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadReceiptFile(order.order_number);
    } catch {
      toast.error('Could not download receipt. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-mono text-xs text-gray-400 mb-0.5">{order.order_number}</p>
          <p className="font-semibold text-gray-900">{order.organization?.name ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">{formatDate(order.completed_at)}</p>
        </div>
        <div className="text-right">
          {isKnownPaymentStatus(order.status_label) ? (
            <PaymentStatusBadge
              status={order.status_label}
              balanceDueDate={order.balance_due_date}
              orderNumber={order.order_number}
            />
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600">
              {order.status_label}
            </span>
          )}
          <p className="text-xl font-bold text-gray-900 mt-2">{order.total}</p>
          {order.payment_method === 'free' && (
            <p className="text-xs text-gray-400">Free registration</p>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-4">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start justify-between text-sm">
            <div>
              <span className="text-gray-900">
                {item.workshop_title ?? item.session_title ?? item.item_type_label}
              </span>
              {item.applied_tier_label && (
                <span className="ml-2 text-xs text-[#0FA3B1] font-medium">
                  {item.applied_tier_label}
                </span>
              )}
              {item.is_deposit && (
                <span className="ml-2 text-xs text-amber-600 font-medium">Deposit</span>
              )}
              {item.workshop_dates && (
                <p className="text-xs text-gray-400 mt-0.5">{item.workshop_dates}</p>
              )}
            </div>
            <span className="text-gray-700 font-medium shrink-0 ml-4">{item.line_total}</span>
          </div>
        ))}
      </div>

      {/* Deposit balance notice */}
      {order.is_deposit_order && !order.balance_paid_at && order.balance_due_date && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800 mb-4">
          Balance due {formatDate(order.balance_due_date)} ·{' '}
          <Link
            href={`/balance-payment/${order.order_number}`}
            className="font-semibold underline underline-offset-2"
          >
            Pay now
          </Link>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex gap-3">
          <Link
            href={`/account/receipts/${order.order_number}`}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
          >
            <Eye size={14} /> View details
          </Link>
        </div>
        {canDownload && (
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#0FA3B1] hover:text-[#0c8a96] transition-colors disabled:opacity-50"
          >
            <Download size={14} /> {downloading ? 'Downloading…' : 'Download Receipt'}
          </button>
        )}
      </div>
    </div>
  );
}

/* --- Empty state -------------------------------------------------------- */

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Receipt className="text-gray-400" size={28} />
      </div>
      <h2 className="font-semibold text-gray-900 mb-2">No receipts yet</h2>
      <p className="text-sm text-gray-500 mb-6">
        Your payment receipts will appear here after you register for workshops.
      </p>
      <Link
        href="/discover"
        className="bg-[#0FA3B1] text-white font-medium px-5 py-2.5 rounded-xl text-sm hover:bg-[#0c8a96] transition-colors"
      >
        Browse Workshops
      </Link>
    </div>
  );
}

/* --- Error state -------------------------------------------------------- */

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="bg-white flex flex-col items-center text-center gap-4 rounded-xl"
      style={{ padding: '48px 32px' }}
    >
      <AlertCircle className="w-10 h-10" style={{ color: '#E94F37' }} />
      <div>
        <p className="font-heading font-semibold mb-1" style={{ color: '#2E2E2E' }}>
          Could not load your receipts
        </p>
        <p className="font-sans text-sm" style={{ color: '#6B7280' }}>
          Check your connection and try again.
        </p>
      </div>
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/* --- Page --------------------------------------------------------------- */

export default function ReceiptsPage() {
  const [selectedYear, setSelectedYear] = useState<YearFilter>(CURRENT_YEAR);
  const [data, setData] = useState<OrderHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = selectedYear !== 'All' ? { year: selectedYear as number } : undefined;
    getOrderHistory(params)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [selectedYear]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const orders = data?.data ?? [];
  const isEmpty = !loading && !error && orders.length === 0;

  return (
    <>
      <style>{`
        @keyframes receiptsShimmer {
          0%   { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1
            className="font-heading font-bold mb-1"
            style={{ fontSize: 24, color: '#2E2E2E' }}
          >
            Receipts &amp; Payments
          </h1>
          <p className="font-sans text-sm" style={{ color: '#6B7280' }}>
            Your payment history and downloadable receipts.
          </p>
        </div>

        {/* Year filter + total spent */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {YEAR_OPTIONS.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setSelectedYear(year)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                  selectedYear === year
                    ? 'bg-[#0FA3B1] text-white border-[#0FA3B1]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {year}
              </button>
            ))}
          </div>

          {data?.meta && (
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-mono mb-0.5">
                Total Paid ({selectedYear === 'All' ? 'All Time' : selectedYear})
              </p>
              <p className="text-2xl font-bold text-gray-900">{data.meta.total_spent}</p>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton height={200} />
            <Skeleton height={200} />
            <Skeleton height={200} />
          </div>
        ) : error ? (
          <ErrorState onRetry={fetchOrders} />
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

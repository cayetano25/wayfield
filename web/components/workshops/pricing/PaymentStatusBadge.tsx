'use client';

import Link from 'next/link';
import { Clock, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';

export type PaymentStatus =
  | 'Free'
  | 'Deposit Paid'
  | 'Fully Paid'
  | 'Balance Due'
  | 'Payment Pending';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  balanceDueDate?: string | null;
  orderNumber?: string | null;
  onPayBalance?: () => void;
}

function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateStr: string): string {
  return parseDateLocal(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function daysUntil(dateStr: string): number {
  const due = parseDateLocal(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function PaymentStatusBadge({
  status,
  balanceDueDate,
  orderNumber,
  onPayBalance,
}: PaymentStatusBadgeProps) {
  const payHref = orderNumber ? `/balance-payment/${orderNumber}` : null;

  if (status === 'Fully Paid') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-700">
        <CheckCircle size={11} />
        Paid
      </span>
    );
  }

  if (status === 'Free') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600">
        Free
      </span>
    );
  }

  if (status === 'Payment Pending') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-700">
        <AlertCircle size={11} />
        Payment Pending
      </span>
    );
  }

  // ── Deposit Paid / Balance Due — urgency tiers ──────────────────────────

  if (status === 'Deposit Paid' || status === 'Balance Due') {
    if (!balanceDueDate) {
      // No due date — just show the static badge.
      const isDepositPaid = status === 'Deposit Paid';
      return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${isDepositPaid ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'}`}>
          <Clock size={11} />
          {isDepositPaid ? 'Deposit Paid' : 'Balance Due'}
        </span>
      );
    }

    const days = daysUntil(balanceDueDate);

    // Grace period expired (registration cancelled)
    if (days < -3) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-500">
          Registration Cancelled
        </span>
      );
    }

    // Overdue — within 3-day grace period
    if (days < 0) {
      const graceDaysLeft = days + 3; // 0..2
      return (
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-700">
            <AlertCircle size={11} />
            Payment Overdue
          </span>
          {payHref ? (
            <Link
              href={payHref}
              className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors rounded-full px-2.5 py-0.5 w-fit"
            >
              Pay now — {graceDaysLeft === 0 ? 'last chance' : `${graceDaysLeft} day${graceDaysLeft !== 1 ? 's' : ''} left`}
            </Link>
          ) : onPayBalance ? (
            <button
              type="button"
              onClick={onPayBalance}
              className="mt-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors rounded-full px-2.5 py-0.5"
            >
              Pay now — {graceDaysLeft === 0 ? 'last chance' : `${graceDaysLeft} day${graceDaysLeft !== 1 ? 's' : ''} left`}
            </button>
          ) : null}
        </div>
      );
    }

    // 1–7 days until due — urgent
    if (days <= 7) {
      return (
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-orange-100 text-orange-700">
            <AlertTriangle size={11} />
            Balance Due Soon
          </span>
          {payHref ? (
            <Link
              href={payHref}
              className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors rounded-full px-2.5 py-0.5 w-fit"
            >
              Pay now
            </Link>
          ) : onPayBalance ? (
            <button
              type="button"
              onClick={onPayBalance}
              className="mt-1.5 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors rounded-full px-2.5 py-0.5"
            >
              Pay now
            </button>
          ) : null}
        </div>
      );
    }

    // 7–14 days — informational nudge
    if (days <= 14) {
      return (
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-700">
            <Clock size={11} />
            Deposit Paid
          </span>
          <p className="text-xs text-amber-700 mt-1">
            Balance due in {days} day{days !== 1 ? 's' : ''} · {formatDate(balanceDueDate)}
          </p>
        </div>
      );
    }

    // More than 14 days — calm amber badge
    return (
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-700">
          <Clock size={11} />
          Deposit Paid
        </span>
        <p className="text-xs text-amber-600 mt-1">
          Balance due {formatDate(balanceDueDate)}
        </p>
      </div>
    );
  }

  // Fallback
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-600">
      {status}
    </span>
  );
}

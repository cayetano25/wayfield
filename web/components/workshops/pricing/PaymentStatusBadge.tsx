'use client';

import { Clock, CheckCircle, AlertCircle } from 'lucide-react';

export type PaymentStatus =
  | 'Free'
  | 'Deposit Paid'
  | 'Fully Paid'
  | 'Balance Due'
  | 'Payment Pending';

interface Config {
  bg: string;
  text: string;
  label: string;
  icon?: React.ReactNode;
}

const CONFIGS: Record<PaymentStatus, Config> = {
  Free:            { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Free' },
  'Fully Paid':    { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Paid',            icon: <CheckCircle size={11} /> },
  'Deposit Paid':  { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Deposit Paid',    icon: <Clock size={11} /> },
  'Balance Due':   { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Balance Due',     icon: <AlertCircle size={11} /> },
  'Payment Pending':{ bg: 'bg-red-100',   text: 'text-red-700',    label: 'Payment Pending', icon: <AlertCircle size={11} /> },
};

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  balanceDueDate?: string | null;
  onPayBalance?: () => void;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function PaymentStatusBadge({ status, balanceDueDate, onPayBalance }: PaymentStatusBadgeProps) {
  const config = CONFIGS[status] ?? CONFIGS['Free'];

  return (
    <div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
          text-xs font-semibold ${config.bg} ${config.text}`}
      >
        {config.icon}
        {config.label}
      </span>

      {status === 'Deposit Paid' && balanceDueDate && (
        <p className="text-xs text-amber-700 mt-1">
          Balance due {formatDate(balanceDueDate)}
        </p>
      )}

      {status === 'Balance Due' && balanceDueDate && (
        <div className="mt-1">
          <p className="text-xs text-orange-700 font-medium">
            ⚠ Balance due {formatDate(balanceDueDate)} — Pay now
          </p>
          {onPayBalance && (
            <button
              type="button"
              onClick={onPayBalance}
              className="mt-1 text-xs font-semibold text-white bg-orange-500
                hover:bg-orange-600 transition-colors rounded-full px-2.5 py-0.5"
            >
              Pay Balance
            </button>
          )}
        </div>
      )}
    </div>
  );
}

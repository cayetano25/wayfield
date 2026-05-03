'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
  CreditCard,
  Pencil,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  platformFinancials,
  platformPayments,
  type FinancialsOverview,
  type InvoiceListItem,
  type TakeRate,
  type StripeConnectAccount,
  type PaymentStatus,
  type FailedPayment,
} from '@/lib/platform-api';
import { useAdminUser, can } from '@/contexts/AdminUserContext';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, TableHead, Th, TableBody, Td } from '@/components/ui/Table';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type FinancialsTab =
  | 'overview'
  | 'invoices'
  | 'payment-controls'
  | 'take-rates'
  | 'stripe-connect'
  | 'failed-payments';

const TABS: Array<{ key: FinancialsTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'payment-controls', label: 'Payment Controls' },
  { key: 'take-rates', label: 'Take Rates' },
  { key: 'stripe-connect', label: 'Stripe Connect' },
  { key: 'failed-payments', label: 'Failed Payments' },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function Mono({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`font-mono ${className}`}
      style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
    >
      {children}
    </span>
  );
}

function StalenessNotice() {
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3 text-sm">
      <AlertTriangle size={15} className="text-amber-500 shrink-0" />
      <span className="text-amber-800">
        Billing data is sourced from Stripe mirror tables and may be up to a few minutes behind.
      </span>
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

const PLAN_CHART_COLORS: Record<string, string> = {
  foundation: '#9CA3AF',
  creator:    '#0FA3B1',
  studio:     '#E67E22',
  enterprise: '#8B5CF6',
};

const PLAN_CHART_LABELS: Record<string, string> = {
  foundation: 'Foundation',
  creator:    'Creator',
  studio:     'Studio',
  enterprise: 'Enterprise',
};

function PlanChart({ byPlan }: { byPlan: FinancialsOverview['subscriptions']['by_plan'] }) {
  const data = Object.entries(byPlan).map(([key, value]) => ({
    name: PLAN_CHART_LABELS[key] ?? key,
    value,
    color: PLAN_CHART_COLORS[key] ?? '#6B7280',
  }));

  const hasData = data.some((d) => d.value > 0);
  if (!hasData) {
    return <p className="text-sm text-gray-400 py-6 text-center">No subscription data yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} barSize={32}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          formatter={(value) => [
            typeof value === 'number' ? value.toLocaleString() : String(value),
            'Subscriptions',
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function OverviewStatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
      <Mono className="text-xs uppercase tracking-widest text-gray-400 mb-1 block">{label}</Mono>
      <p className="font-heading text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function OverviewTab({
  overview,
  loading,
  error,
  onRetry,
}: {
  overview: FinancialsOverview | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (error) return <ErrorBanner message={error} onRetry={onRetry} />;
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-28" />
        ))}
      </div>
    );
  }
  if (!overview) return null;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <OverviewStatCard
          label="MRR"
          value={overview.mrr_cents !== null ? formatCents(overview.mrr_cents) : '—'}
          sub="Monthly recurring"
        />
        <OverviewStatCard
          label="ARR"
          value={overview.arr_cents !== null ? formatCents(overview.arr_cents) : '—'}
          sub="Annual run rate"
        />
        <OverviewStatCard
          label="Active"
          value={overview.subscriptions.active}
          sub={`${overview.subscriptions.trialing} trialing`}
        />
        <OverviewStatCard
          label="Past Due"
          value={overview.subscriptions.past_due}
          sub={`${overview.subscriptions.canceled} canceled`}
        />
      </div>
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
        <h3 className="font-heading text-sm font-semibold text-gray-800 mb-4">
          Subscriptions by Plan
        </h3>
        <PlanChart byPlan={overview.subscriptions.by_plan} />
      </div>
      {!overview.stripe_webhook_connected && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3 text-sm">
          <AlertTriangle size={15} className="text-red-500 shrink-0" />
          <span className="text-red-800">
            Stripe webhook is not connected. Financial data may be incomplete or missing.
          </span>
        </div>
      )}
    </>
  );
}

// ─── Invoices tab ─────────────────────────────────────────────────────────────

function InvoiceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid:          'bg-teal-50 text-teal-700 ring-teal-600/20',
    open:          'bg-blue-50 text-blue-700 ring-blue-600/20',
    void:          'bg-gray-100 text-gray-600 ring-gray-500/20',
    uncollectible: 'bg-red-50 text-red-700 ring-red-600/20',
  };
  const cls = styles[status] ?? 'bg-gray-100 text-gray-600 ring-gray-500/20';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize ${cls}`}>
      {status}
    </span>
  );
}

function InvoicesTab() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoiceLastPage, setInvoiceLastPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const STATUS_FILTERS = [
    { value: '', label: 'All Statuses' },
    { value: 'paid', label: 'Paid' },
    { value: 'open', label: 'Open' },
    { value: 'void', label: 'Void' },
    { value: 'uncollectible', label: 'Uncollectible' },
  ];

  async function load(status: string, page: number) {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformFinancials.invoices({ status: status || undefined, page });
      setInvoices(data.data);
      setInvoiceTotal(data.total);
      setInvoiceLastPage(data.last_page);
    } catch {
      setError('Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(statusFilter, invoicePage);
  }, [statusFilter, invoicePage]); // eslint-disable-line react-hooks/exhaustive-deps

  const from = invoiceTotal === 0 ? 0 : (invoicePage - 1) * 25 + 1;
  const to = Math.min(invoicePage * 25, invoiceTotal);

  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-heading text-sm font-semibold text-gray-800">Invoices</h3>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setInvoicePage(1); }}
          className="min-h-[36px] px-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] appearance-none pr-6"
        >
          {STATUS_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="p-4">
          <ErrorBanner message={error} onRetry={() => load(statusFilter, invoicePage)} />
        </div>
      ) : (
        <Table>
          <TableHead>
            <Th>Organisation</Th>
            <Th>Invoice ID</Th>
            <Th>Date</Th>
            <Th>Amount Due</Th>
            <Th>Status</Th>
            <Th className="w-16" />
          </TableHead>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-1">
                    <div className="animate-pulse bg-gray-100 h-10 rounded my-1" />
                  </td>
                </tr>
              ))
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  No invoices found.
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <Td>
                    <span className="text-sm font-medium text-gray-900">{inv.organization_name ?? '—'}</span>
                  </Td>
                  <Td>
                    <Mono className="text-xs text-gray-500">{inv.stripe_invoice_id}</Mono>
                  </Td>
                  <Td>
                    <span className="text-sm text-gray-500">
                      {inv.invoice_date ? format(new Date(inv.invoice_date), 'MMM d, yyyy') : '—'}
                    </span>
                  </Td>
                  <Td>
                    <Mono className="text-sm font-medium text-gray-800">{formatCents(inv.amount_due)}</Mono>
                  </Td>
                  <Td><InvoiceStatusBadge status={inv.status} /></Td>
                  <Td>
                    {inv.invoice_pdf_url && (
                      <a
                        href={inv.invoice_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] flex items-center gap-1 text-sm text-[#0FA3B1] hover:text-[#0d8f9c] transition-colors"
                      >
                        PDF <ExternalLink size={12} />
                      </a>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {!loading && !error && invoiceTotal > 0 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            Showing {from}–{to} of {invoiceTotal.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setInvoicePage((p) => p - 1)}
              disabled={invoicePage <= 1}
              className="min-h-[36px] px-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setInvoicePage((p) => p + 1)}
              disabled={invoicePage >= invoiceLastPage}
              className="min-h-[36px] px-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Payment Controls tab ─────────────────────────────────────────────────────

function EnablePaymentsModal({
  status,
  loading,
  onConfirm,
  onCancel,
}: {
  status: PaymentStatus;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enable-payments-title"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2
          id="enable-payments-title"
          className="font-heading text-lg font-semibold text-gray-900 mb-2"
        >
          Enable Platform Payments
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          This will make payment surfaces visible to all organisations that have been individually
          enabled ({status.orgs_payment_enabled_count} orgs ready). Participants will be able to
          pay for workshops immediately.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            data-testid="enable-payments-confirm"
            className="min-h-[44px] px-6 text-sm font-medium text-white bg-[#0FA3B1] hover:bg-[#0d8f9c] rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading ? 'Enabling…' : 'Enable Payments'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DisablePaymentsModal({
  status,
  loading,
  onConfirm,
  onCancel,
}: {
  status: PaymentStatus;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [confirmInput, setConfirmInput] = useState('');
  const isConfirmed = confirmInput === 'DISABLE';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disable-payments-title"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2
          id="disable-payments-title"
          className="font-heading text-lg font-semibold text-gray-900 mb-4"
        >
          ⚠ Disable Platform Payments
        </h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
          <p className="text-sm text-amber-700">
            This is a platform-wide action. ALL payment surfaces across ALL organisations will
            be hidden immediately. Participants in the middle of checkout will lose their cart.
            This affects {status.orgs_payment_enabled_count} organisations.
          </p>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type{' '}
            <Mono className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">DISABLE</Mono>{' '}
            to confirm
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="DISABLE"
            data-testid="disable-confirm-input"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !isConfirmed}
            data-testid="disable-payments-confirm"
            className="min-h-[44px] px-6 text-sm font-medium text-white bg-[#E94F37] hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading ? 'Disabling…' : 'Disable All Payments'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentControlsTab() {
  const { adminUser } = useAdminUser();
  const { toast } = useToast();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEnableModal, setShowEnableModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [mutating, setMutating] = useState(false);

  const canManage = adminUser ? can.managePayments(adminUser.role) : false;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformPayments.status();
      setStatus(data);
    } catch {
      setError('Failed to load payment status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleEnable() {
    setMutating(true);
    try {
      const { data } = await platformPayments.enable();
      setStatus(data);
      setShowEnableModal(false);
      toast('Platform payments enabled.', 'success');
    } catch {
      toast('Failed to enable payments. Please try again.', 'error');
    } finally {
      setMutating(false);
    }
  }

  async function handleDisable() {
    setMutating(true);
    try {
      const { data } = await platformPayments.disable();
      setStatus(data);
      setShowDisableModal(false);
      toast('Platform payments disabled.', 'success');
    } catch {
      toast('Failed to disable payments. Please try again.', 'error');
    } finally {
      setMutating(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="animate-pulse bg-gray-200 rounded-2xl h-40" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !status) {
    return <ErrorBanner message={error ?? 'Payment status unavailable.'} onRetry={load} />;
  }

  const isOn = status.platform_payments_enabled;
  const borderColor = isOn ? 'border-teal-400' : 'border-amber-400';
  const needsStripe =
    status.orgs_stripe_connected_count < status.orgs_payment_enabled_count;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Platform payment switch card */}
      <div
        className={`bg-white rounded-2xl border-2 ${borderColor} shadow-md p-8 flex items-center justify-between gap-6`}
      >
        <div>
          <Mono
            className={`text-xs uppercase tracking-widest font-medium block mb-2 ${
              isOn ? 'text-teal-600' : 'text-amber-600'
            }`}
          >
            {isOn ? 'GLOBAL PAYMENTS — ACTIVE' : 'GLOBAL PAYMENTS — DISABLED'}
          </Mono>
          <div className="mb-2">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                isOn
                  ? 'bg-teal-50 text-teal-700 border border-teal-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {isOn ? 'Payments Active' : 'Payments Disabled'}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Controls payment surfaces across all {status.orgs_payment_enabled_count} organisations
          </p>
        </div>

        {canManage && (
          <div className="shrink-0">
            {isOn ? (
              <button
                onClick={() => setShowDisableModal(true)}
                data-testid="disable-payments-btn"
                className="min-h-[44px] px-6 text-sm font-medium text-white bg-[#E94F37] hover:bg-red-700 rounded-lg transition-colors"
              >
                Disable Platform Payments
              </button>
            ) : (
              <button
                onClick={() => setShowEnableModal(true)}
                data-testid="enable-payments-btn"
                className="min-h-[44px] px-6 text-sm font-medium text-white bg-[#0FA3B1] hover:bg-[#0d8f9c] rounded-lg transition-colors"
              >
                Enable Platform Payments
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stripe connect gap warning — only when platform is ON */}
      {isOn && needsStripe && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2 text-sm">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <span className="text-amber-800">
            {status.orgs_payment_enabled_count - status.orgs_stripe_connected_count} organisations
            are payment-enabled but Stripe Connect is not complete — they cannot process payments yet.
          </span>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        {[
          { label: 'ORGS WITH PAYMENTS ON', value: status.orgs_payment_enabled_count },
          { label: 'STRIPE CONNECTED', value: status.orgs_stripe_connected_count },
          { label: 'CHARGES ENABLED', value: status.orgs_stripe_charges_enabled_count },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <Mono className="text-xs uppercase tracking-widest text-gray-400 mb-1 block">{label}</Mono>
            <p className="font-heading text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {showEnableModal && (
        <EnablePaymentsModal
          status={status}
          loading={mutating}
          onConfirm={handleEnable}
          onCancel={() => setShowEnableModal(false)}
        />
      )}
      {showDisableModal && (
        <DisablePaymentsModal
          status={status}
          loading={mutating}
          onConfirm={handleDisable}
          onCancel={() => setShowDisableModal(false)}
        />
      )}
    </div>
  );
}

// ─── Take Rates tab ───────────────────────────────────────────────────────────

const TAKE_RATE_BADGE_STYLES: Record<string, string> = {
  foundation: 'bg-gray-100 text-gray-600 border border-gray-200',
  creator:    'bg-teal-50 text-teal-700 border border-teal-200',
  studio:     'bg-orange-50 text-orange-700 border border-orange-200',
  custom:     'bg-purple-50 text-purple-700 border border-purple-200',
};

const TAKE_RATE_DISPLAY_NAMES: Record<string, string> = {
  foundation: 'Foundation',
  creator:    'Creator',
  studio:     'Studio',
  custom:     'Enterprise',
};

function TakeRatePlanBadge({ planCode }: { planCode: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        TAKE_RATE_BADGE_STYLES[planCode] ?? 'bg-gray-100 text-gray-600 border border-gray-200'
      }`}
    >
      {TAKE_RATE_DISPLAY_NAMES[planCode] ?? planCode}
    </span>
  );
}

function EditTakeRateModal({
  rate,
  loading,
  onSave,
  onCancel,
  error,
}: {
  rate: TakeRate;
  loading: boolean;
  onSave: (newRatePct: number, notes: string) => void;
  onCancel: () => void;
  error: string | null;
}) {
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState(rate.notes ?? '');

  const numericValue = parseFloat(value);
  const isValidRate = !isNaN(numericValue) && numericValue >= 0 && numericValue <= 20;
  const feePreview = isValidRate ? `$${numericValue.toFixed(2)}` : '—';
  const displayName = TAKE_RATE_DISPLAY_NAMES[rate.plan_code] ?? rate.plan_code;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-take-rate-title"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2
          id="edit-take-rate-title"
          className="font-heading text-lg font-semibold text-gray-900 mb-4"
        >
          Edit Take Rate — {displayName}
        </h2>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Current Rate</p>
          <p className="text-sm font-medium text-gray-700">
            {rate.take_rate_pct}% &mdash; fee on $100: {rate.fee_on_100}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Rate <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              max="20"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid="take-rate-input"
              placeholder={rate.take_rate_pct}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
            />
            <span className="text-sm text-gray-500 font-medium">%</span>
          </div>
          <p className="text-xs text-gray-400 mt-1" data-testid="take-rate-preview">
            Fee on $100: {feePreview}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] resize-none"
          />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          <p className="text-xs text-amber-700">
            Changes affect all future {displayName} transactions. Past payments are unaffected.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={14} className="shrink-0" /> {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(numericValue, notes)}
            disabled={loading || !isValidRate}
            className="min-h-[44px] px-4 text-sm font-medium text-white bg-[#0FA3B1] hover:bg-[#0d8f9c] rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving…' : 'Save Rate'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TakeRatesTab() {
  const { adminUser } = useAdminUser();
  const { toast } = useToast();
  const [rates, setRates] = useState<TakeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TakeRate | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canEdit = adminUser ? can.manageTakeRates(adminUser.role) : false;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformPayments.takeRates();
      setRates(Array.isArray(data) ? data : (data as unknown as { data: TakeRate[] }).data ?? []);
    } catch {
      setError('Failed to load take rates.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(newRatePct: number, notes: string) {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { data } = await platformPayments.updateTakeRate(editing.plan_code, {
        take_rate_pct: newRatePct / 100,
        notes: notes.trim() || undefined,
      });
      setRates((prev) => prev.map((r) => (r.plan_code === editing.plan_code ? data : r)));
      setEditing(null);
      toast(
        `Take rate updated for ${TAKE_RATE_DISPLAY_NAMES[editing.plan_code] ?? editing.plan_code}.`,
        'success',
      );
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        toast('Only super admins can edit take rates.', 'error');
        setSaveError('Only super admins can edit take rates.');
      } else if (status === 422) {
        setSaveError('Invalid rate value. Must be between 0% and 20%.');
      } else {
        setSaveError('Failed to update take rate. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="animate-pulse bg-gray-200 rounded-xl h-48" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Info notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <p className="text-sm text-blue-700">
          Take rates are Wayfield&rsquo;s transaction fee on each participant payment. Deducted via
          Stripe Connect before funds transfer to organisers. Changes take effect on new transactions
          immediately.
        </p>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHead>
            <Th>Plan Code</Th>
            <Th>Display Name</Th>
            <Th>Take Rate</Th>
            <Th>Fee on $100</Th>
            <Th>Notes</Th>
            {canEdit && <Th className="w-24" />}
          </TableHead>
          <TableBody>
            {rates.map((rate) => (
              <tr key={rate.plan_code} className="hover:bg-gray-50">
                <Td>
                  <Mono className="text-sm text-gray-900">{rate.plan_code}</Mono>
                </Td>
                <Td>
                  <TakeRatePlanBadge planCode={rate.plan_code} />
                </Td>
                <Td>
                  <Mono className="text-sm font-medium text-gray-900">{rate.take_rate_pct}%</Mono>
                </Td>
                <Td>
                  <Mono className="text-sm text-gray-700">{rate.fee_on_100}</Mono>
                </Td>
                <Td>
                  <span className="text-sm text-gray-500">{rate.notes ?? '—'}</span>
                </Td>
                {canEdit && (
                  <Td>
                    <button
                      onClick={() => { setEditing(rate); setSaveError(null); }}
                      data-testid={`edit-take-rate-${rate.plan_code}`}
                      className="min-h-[44px] flex items-center gap-1.5 px-3 text-sm text-[#0FA3B1] hover:text-[#0d8f9c] transition-colors"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                  </Td>
                )}
              </tr>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <EditTakeRateModal
          rate={editing}
          loading={saving}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setSaveError(null); }}
          error={saveError}
        />
      )}
    </div>
  );
}

// ─── Stripe Connect tab ───────────────────────────────────────────────────────

const CONNECT_STATUS_STYLES: Record<string, string> = {
  complete:     'bg-teal-50 text-teal-700 border border-teal-200',
  pending:      'bg-amber-50 text-amber-700 border border-amber-200',
  initiated:    'bg-blue-50 text-blue-700 border border-blue-200',
  restricted:   'bg-orange-50 text-orange-700 border border-orange-200',
  deauthorized: 'bg-red-50 text-red-700 border border-red-200',
};

function ConnectStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        CONNECT_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600 border border-gray-200'
      }`}
    >
      {status}
    </span>
  );
}

function BoolIcon({ value }: { value: boolean }) {
  return value ? (
    <CheckCircle size={16} className="text-teal-500" aria-label="Yes" />
  ) : (
    <XCircle size={16} className="text-gray-300" aria-label="No" />
  );
}

function StripeConnectTab() {
  const [accounts, setAccounts] = useState<StripeConnectAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [chargesFilter, setChargesFilter] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformPayments.connectAccounts({
        onboarding_status: statusFilter || undefined,
        charges_enabled:
          chargesFilter === 'yes' ? true : chargesFilter === 'no' ? false : undefined,
      });
      if (data.stripe_connect_not_configured) {
        setNotConfigured(true);
        setAccounts([]);
      } else {
        setNotConfigured(false);
        setAccounts(data.data);
      }
    } catch {
      setError('Failed to load Stripe Connect accounts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter, chargesFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusCounts = {
    complete:     accounts.filter((a) => a.onboarding_status === 'complete').length,
    pending:      accounts.filter((a) => a.onboarding_status === 'pending').length,
    restricted:   accounts.filter((a) => a.onboarding_status === 'restricted').length,
    deauthorized: accounts.filter((a) => a.onboarding_status === 'deauthorized').length,
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-20" />
          ))}
        </div>
        <div className="animate-pulse bg-gray-100 rounded-xl h-48" />
      </div>
    );
  }

  if (error) return <ErrorBanner message={error} onRetry={load} />;

  if (notConfigured || accounts.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        heading="No Stripe Connect accounts"
        subtitle="Stripe Connect accounts appear here when organisers complete onboarding."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Complete', count: statusCounts.complete, color: 'text-teal-600' },
          { label: 'Pending', count: statusCounts.pending, color: 'text-amber-600' },
          { label: 'Restricted', count: statusCounts.restricted, color: 'text-orange-600' },
          { label: 'Deauthorized', count: statusCounts.deauthorized, color: 'text-red-600' },
        ].map(({ label, count, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <Mono className="text-xs uppercase tracking-widest text-gray-400 mb-1 block">{label}</Mono>
            <p className={`font-heading text-2xl font-bold ${color}`}>{count}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-[36px] px-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
        >
          <option value="">All Statuses</option>
          <option value="complete">Complete</option>
          <option value="pending">Pending</option>
          <option value="initiated">Initiated</option>
          <option value="restricted">Restricted</option>
          <option value="deauthorized">Deauthorized</option>
        </select>
        <select
          value={chargesFilter}
          onChange={(e) => setChargesFilter(e.target.value)}
          className="min-h-[36px] px-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
        >
          <option value="">Charges: All</option>
          <option value="yes">Charges: Yes</option>
          <option value="no">Charges: No</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHead>
            <Th>Organisation</Th>
            <Th>Status</Th>
            <Th>Charges</Th>
            <Th>Payouts</Th>
            <Th>Submitted</Th>
            <Th>Last Webhook</Th>
            <Th>Reqs</Th>
            <Th className="w-10" />
          </TableHead>
          <TableBody>
            {accounts.map((acct) => (
              <tr key={acct.organization_id} className="hover:bg-gray-50">
                <Td>
                  <span className="text-sm font-medium text-gray-900">{acct.organization_name}</span>
                </Td>
                <Td>
                  <ConnectStatusBadge status={acct.onboarding_status} />
                </Td>
                <Td><BoolIcon value={acct.charges_enabled} /></Td>
                <Td><BoolIcon value={acct.payouts_enabled} /></Td>
                <Td><BoolIcon value={acct.details_submitted} /></Td>
                <Td>
                  <Mono className="text-xs text-gray-400">
                    {acct.last_webhook_received_at
                      ? formatDistanceToNow(new Date(acct.last_webhook_received_at), {
                          addSuffix: true,
                        })
                      : 'Never'}
                  </Mono>
                </Td>
                <Td>
                  {acct.has_pending_requirements ? (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      Pending
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </Td>
                <Td>
                  <a
                    href={`/organizations/${acct.organization_id}?tab=payments`}
                    className="min-h-[44px] flex items-center text-[#0FA3B1] hover:text-[#0d8f9c] transition-colors"
                    aria-label={`View ${acct.organization_name} payments`}
                  >
                    →
                  </a>
                </Td>
              </tr>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-gray-400 text-right">
        Manage Connect accounts in the Stripe Dashboard.
      </p>
    </div>
  );
}

// ─── Failed Payments tab ─────────────────────────────────────────────────────

function FailedPaymentsTab() {
  const [payments, setPayments] = useState<FailedPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [page, setPage] = useState(1);
  const [orgSearch, setOrgSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhookRequired, setWebhookRequired] = useState(false);

  async function load(pg: number) {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformFinancials.failedPayments({
        date_from: dateFrom || undefined,
        date_to:   dateTo   || undefined,
        page: pg,
      });
      if (data.stripe_webhook_required) {
        setWebhookRequired(true);
        setPayments([]);
        setTotal(0);
        setLastPage(1);
      } else {
        setWebhookRequired(false);
        setPayments(data.data);
        setTotal(data.total);
        setLastPage(data.last_page);
      }
    } catch {
      setWebhookRequired(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(page); }, [page, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilter() {
    setPage(1);
    load(1);
  }

  const filteredPayments = orgSearch.trim()
    ? payments.filter((p) =>
        p.organization_name.toLowerCase().includes(orgSearch.toLowerCase()),
      )
    : payments;

  const from = total === 0 ? 0 : (page - 1) * 25 + 1;
  const to   = Math.min(page * 25, total);

  if (webhookRequired) {
    return (
      <div
        className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-5 flex items-start gap-3 max-w-2xl"
        data-testid="failed-payments-unavailable"
      >
        <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 mb-1">
            Failed payment data requires the Stripe webhook to be connected.
          </p>
          <p className="text-sm text-amber-700">
            See <Mono className="text-xs bg-amber-100 px-1 py-0.5 rounded">OPEN_QUESTIONS Q4</Mono> for details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={orgSearch}
          onChange={(e) => setOrgSearch(e.target.value)}
          placeholder="Filter by organisation…"
          className="min-h-[36px] px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] w-52"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="min-h-[36px] px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
          aria-label="Date from"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="min-h-[36px] px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
          aria-label="Date to"
        />
      </div>

      <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        {error ? (
          <div className="p-4">
            <ErrorBanner message={error} onRetry={() => load(page)} />
          </div>
        ) : (
          <Table>
            <TableHead>
              <Th>Organisation</Th>
              <Th>Amount</Th>
              <Th>Failure Reason</Th>
              <Th>Customer Email</Th>
              <Th>Date / Time</Th>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-4 py-1">
                      <div className="animate-pulse bg-gray-100 h-10 rounded my-1" />
                    </td>
                  </tr>
                ))
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                    data-testid="failed-payments-empty"
                  >
                    No failed payments in the selected period.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <Td>
                      <span className="text-sm font-medium text-gray-900">{p.organization_name}</span>
                    </Td>
                    <Td>
                      <Mono className="text-sm font-medium text-gray-800">
                        {formatCents(p.amount_cents)}
                      </Mono>
                    </Td>
                    <Td>
                      <span
                        className="text-sm text-gray-700 block max-w-xs truncate"
                        title={p.failure_reason ?? undefined}
                      >
                        {p.failure_reason
                          ? p.failure_reason.slice(0, 80) + (p.failure_reason.length > 80 ? '…' : '')
                          : '—'}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-sm text-gray-600">{p.customer_email ?? '—'}</span>
                    </Td>
                    <Td>
                      <Mono className="text-xs text-gray-400">
                        {new Date(p.created_at).toLocaleString()}
                      </Mono>
                    </Td>
                  </tr>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {!loading && !error && total > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Showing {from}–{to} of {total.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="min-h-[36px] px-3 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= lastPage}
              className="min-h-[36px] px-3 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancialsPage() {
  const { adminUser } = useAdminUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [overview, setOverview] = useState<FinancialsOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const activeTab = (searchParams.get('tab') ?? 'overview') as FinancialsTab;

  function setTab(tab: FinancialsTab) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', tab);
    router.replace(`/financials?${p.toString()}`);
  }

  useEffect(() => {
    if (adminUser && !can.viewFinancials(adminUser.role)) {
      router.replace('/');
    }
  }, [adminUser, router]);

  async function loadOverview() {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const { data } = await platformFinancials.overview();
      setOverview(data);
    } catch {
      setOverviewError('Failed to load financial overview.');
    } finally {
      setOverviewLoading(false);
    }
  }

  useEffect(() => { loadOverview(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Financials" />
        <button
          onClick={loadOverview}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <StalenessNotice />

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {TABS.map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`min-h-[44px] px-5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-[#0FA3B1] text-[#0FA3B1]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab
          overview={overview}
          loading={overviewLoading}
          error={overviewError}
          onRetry={loadOverview}
        />
      )}
      {activeTab === 'invoices' && <InvoicesTab />}
      {activeTab === 'payment-controls' && <PaymentControlsTab />}
      {activeTab === 'take-rates' && <TakeRatesTab />}
      {activeTab === 'stripe-connect' && <StripeConnectTab />}
      {activeTab === 'failed-payments' && <FailedPaymentsTab />}
    </div>
  );
}

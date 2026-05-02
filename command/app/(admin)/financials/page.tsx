'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
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
  type FinancialsOverview,
  type InvoiceListItem,
  type Paginated,
} from '@/lib/platform-api';
import { useAdminUser, can } from '@/contexts/AdminUserContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Table, TableHead, Th, TableBody, Td } from '@/components/ui/Table';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
      <p
        className="text-xs uppercase tracking-widest text-gray-400 mb-1"
        style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
      >
        {label}
      </p>
      <p className="font-heading text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Plan distribution chart ──────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  free: '#9CA3AF',
  starter: '#0FA3B1',
  pro: '#7EA8BE',
  enterprise: '#E67E22',
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

function PlanChart({ byPlan }: { byPlan: FinancialsOverview['subscriptions']['by_plan'] }) {
  const data = Object.entries(byPlan).map(([key, value]) => ({
    name: PLAN_LABELS[key] ?? key,
    value,
    color: PLAN_COLORS[key] ?? '#6B7280',
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

// ─── Invoice status badge ─────────────────────────────────────────────────────

function InvoiceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid:       'bg-teal-50 text-teal-700 ring-teal-600/20',
    open:       'bg-blue-50 text-blue-700 ring-blue-600/20',
    void:       'bg-gray-100 text-gray-600 ring-gray-500/20',
    uncollectible: 'bg-red-50 text-red-700 ring-red-600/20',
  };
  const cls = styles[status] ?? 'bg-gray-100 text-gray-600 ring-gray-500/20';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize ${cls}`}>
      {status}
    </span>
  );
}

// ─── Staleness / webhook notices ──────────────────────────────────────────────

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

function WebhookWarning() {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3 text-sm">
      <AlertTriangle size={15} className="text-red-500 shrink-0" />
      <span className="text-red-800">
        Stripe webhook is not connected. Financial data may be incomplete or missing.
      </span>
    </div>
  );
}

// ─── Invoice table skeleton ───────────────────────────────────────────────────

function InvoiceSkeleton() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <tr key={i}>
          <td colSpan={6} className="px-4 py-1">
            <div className="animate-pulse bg-gray-100 h-10 rounded my-1" />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'open', label: 'Open' },
  { value: 'void', label: 'Void' },
  { value: 'uncollectible', label: 'Uncollectible' },
];

export default function FinancialsPage() {
  const { adminUser } = useAdminUser();
  const router = useRouter();

  const [overview, setOverview] = useState<FinancialsOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [invoiceLastPage, setInvoiceLastPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

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

  async function loadInvoices(status: string, page: number) {
    setInvoicesLoading(true);
    setInvoicesError(null);
    try {
      const { data } = await platformFinancials.invoices({
        status: status || undefined,
        page,
      });
      setInvoices(data.data);
      setInvoiceTotal(data.total);
      setInvoiceLastPage(data.last_page);
    } catch {
      setInvoicesError('Failed to load invoices.');
    } finally {
      setInvoicesLoading(false);
    }
  }

  useEffect(() => { loadOverview(); }, []);
  useEffect(() => { loadInvoices(statusFilter, invoicePage); }, [statusFilter, invoicePage]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setInvoicePage(1);
  }

  const from = invoiceTotal === 0 ? 0 : (invoicePage - 1) * 25 + 1;
  const to = Math.min(invoicePage * 25, invoiceTotal);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Financials" />
        <button
          onClick={() => { loadOverview(); loadInvoices(statusFilter, invoicePage); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Always-visible staleness notice */}
      <StalenessNotice />

      {/* Webhook warning — shown when not connected */}
      {overview && !overview.stripe_webhook_connected && <WebhookWarning />}

      {/* Overview stats */}
      {overviewError ? (
        <ErrorBanner message={overviewError} onRetry={loadOverview} />
      ) : overviewLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-28" />
          ))}
        </div>
      ) : overview ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="MRR"
              value={overview.mrr_cents !== null ? formatCents(overview.mrr_cents) : '—'}
              sub="Monthly recurring"
            />
            <StatCard
              label="ARR"
              value={overview.arr_cents !== null ? formatCents(overview.arr_cents) : '—'}
              sub="Annual run rate"
            />
            <StatCard
              label="Active"
              value={overview.subscriptions.active}
              sub={`${overview.subscriptions.trialing} trialing`}
            />
            <StatCard
              label="Trialing"
              value={overview.subscriptions.trialing}
              sub={`${overview.subscriptions.past_due} past due`}
            />
          </div>

          {/* Plan distribution */}
          <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
            <h3 className="font-heading text-sm font-semibold text-gray-800 mb-4">
              Subscriptions by Plan
            </h3>
            <PlanChart byPlan={overview.subscriptions.by_plan} />
          </div>
        </>
      ) : null}

      {/* Invoices */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-heading text-sm font-semibold text-gray-800">Invoices</h3>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="min-h-[36px] px-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] appearance-none pr-6"
          >
            {STATUS_FILTERS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {invoicesError ? (
          <div className="p-4">
            <ErrorBanner message={invoicesError} onRetry={() => loadInvoices(statusFilter, invoicePage)} />
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
              {invoicesLoading ? (
                <InvoiceSkeleton />
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
                      <span className="text-sm font-medium text-gray-900">
                        {inv.organization_name ?? '—'}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="text-xs text-gray-500 font-mono"
                        style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                      >
                        {inv.stripe_invoice_id}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-sm text-gray-500">
                        {inv.invoice_date
                          ? format(new Date(inv.invoice_date), 'MMM d, yyyy')
                          : '—'}
                      </span>
                    </Td>
                    <Td>
                      <span
                        className="text-sm font-medium text-gray-800"
                        style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                      >
                        {formatCents(inv.amount_due)}
                      </span>
                    </Td>
                    <Td>
                      <InvoiceStatusBadge status={inv.status} />
                    </Td>
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

        {/* Invoice pagination */}
        {!invoicesLoading && !invoicesError && invoiceTotal > 0 && (
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
    </div>
  );
}

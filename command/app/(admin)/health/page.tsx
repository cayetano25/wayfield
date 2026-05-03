'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Info, RefreshCw } from 'lucide-react';
import {
  platformHealth,
  type SesDeliveryStats,
  type OrgEmailDelivery,
} from '@/lib/platform-api';
import { useAdminUser, can } from '@/contexts/AdminUserContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Table, TableHead, Th, TableBody, Td } from '@/components/ui/Table';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Mono({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`font-mono ${className}`} style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}>
      {children}
    </span>
  );
}

function formatRate(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

function bounceRateClass(pct: number): string {
  if (pct > 5) return 'text-red-600 font-medium';
  if (pct >= 2) return 'text-amber-600';
  return 'text-gray-500';
}

function complaintRateClass(pct: number): string {
  if (pct > 0.1) return 'text-red-600 font-medium';
  if (pct > 0.05) return 'text-amber-600';
  return 'text-gray-500';
}

// ─── SES Delivery Stats section ───────────────────────────────────────────────

function SesStatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <Mono className="text-xs uppercase tracking-widest text-gray-400 mb-1 block">{label}</Mono>
      <p className="font-heading text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function SesDeliveryStatsSection() {
  const [stats, setStats] = useState<SesDeliveryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformHealth.sesStats();
      setStats(data);
    } catch {
      setError('Failed to load SES delivery stats.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-28" />
        ))}
      </div>
    );
  }

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SesStatCard
          label="Sent (30d)"
          value={stats.sent_30d.toLocaleString()}
        />
        <SesStatCard
          label="Bounce Rate"
          value={formatRate(stats.bounce_rate_pct)}
          sub={`${stats.bounced_30d.toLocaleString()} bounced`}
        />
        <SesStatCard
          label="Complaint Rate"
          value={formatRate(stats.complaint_rate_pct)}
          sub={`${stats.complained_30d.toLocaleString()} complaints`}
        />
        <SesStatCard
          label="Delivered (30d)"
          value={stats.delivered_30d.toLocaleString()}
        />
      </div>
      {stats.last_updated && (
        <p className="text-xs text-gray-400 text-right">
          Last updated: {new Date(stats.last_updated).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ─── Email Delivery by Organisation section ───────────────────────────────────

function StatusBadge({ status }: { status: OrgEmailDelivery['status'] }) {
  if (status === 'high_bounce') {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200"
        data-testid="high-bounce-badge"
      >
        ⚠ High bounce
      </span>
    );
  }
  if (status === 'no_data') {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
        —
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100">
      OK
    </span>
  );
}

function EmailByOrgSection() {
  const [rows, setRows] = useState<OrgEmailDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [minBounce, setMinBounce] = useState('');

  async function load(minRate?: number) {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformHealth.emailByOrg(
        minRate !== undefined && minRate > 0 ? { min_bounce_rate: minRate } : undefined,
      );
      if (!Array.isArray(data)) {
        setUnavailable(true);
        setRows([]);
      } else {
        setUnavailable(false);
        setRows(data);
      }
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const parsed = parseFloat(minBounce);
    load(isNaN(parsed) ? undefined : parsed);
  }, [minBounce]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-base font-semibold text-gray-900"
            style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
          >
            Email Delivery by Organisation
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Organisations with bounce rate &gt; 5% may risk SES suspension.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-sm text-gray-600 whitespace-nowrap">
            Min bounce rate (%):
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={minBounce}
            onChange={(e) => setMinBounce(e.target.value)}
            placeholder="0"
            data-testid="min-bounce-filter"
            className="w-24 min-h-[36px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
          />
        </div>
      </div>

      {unavailable ? (
        <div
          className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-4 flex items-start gap-3"
          data-testid="email-by-org-unavailable"
        >
          <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">Email log data not available.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <Table>
            <TableHead>
              <Th>Organisation</Th>
              <Th>Sent (30d)</Th>
              <Th>Bounce Rate</Th>
              <Th>Complaint Rate</Th>
              <Th>Status</Th>
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
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4">
                    <ErrorBanner message={error} onRetry={() => {
                      const parsed = parseFloat(minBounce);
                      load(isNaN(parsed) ? undefined : parsed);
                    }} />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No organisations match the current filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isHighBounce = row.bounce_rate_pct > 5;
                  return (
                    <tr
                      key={row.organization_id}
                      className={`hover:bg-gray-50 transition-colors ${isHighBounce ? 'bg-red-50' : ''}`}
                      data-testid={`org-row-${row.organization_id}`}
                    >
                      <Td>
                        <span className="text-sm font-medium text-gray-900">{row.organization_name}</span>
                      </Td>
                      <Td>
                        <Mono className="text-sm text-gray-700">{row.sent_30d.toLocaleString()}</Mono>
                      </Td>
                      <Td>
                        <Mono
                          className={`text-sm ${bounceRateClass(row.bounce_rate_pct)}`}
                          data-testid={`bounce-rate-${row.organization_id}`}
                        >
                          {formatRate(row.bounce_rate_pct)}
                        </Mono>
                      </Td>
                      <Td>
                        <Mono
                          className={`text-sm ${complaintRateClass(row.complaint_rate_pct)}`}
                          data-testid={`complaint-rate-${row.organization_id}`}
                        >
                          {formatRate(row.complaint_rate_pct)}
                        </Mono>
                      </Td>
                      <Td>
                        <StatusBadge status={row.status} />
                      </Td>
                    </tr>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HealthPage() {
  const { adminUser } = useAdminUser();
  const router = useRouter();

  useEffect(() => {
    if (adminUser && !can.viewHealth(adminUser.role)) {
      router.replace('/');
    }
  }, [adminUser, router]);

  if (!adminUser || !can.viewHealth(adminUser.role)) return null;

  return (
    <div className="max-w-6xl space-y-8">
      <PageHeader
        title="Health Monitor"
        subtitle="Platform and email delivery status"
        right={
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors min-h-[44px]"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      {/* SES Delivery Stats */}
      <section>
        <h2
          className="text-base font-semibold text-gray-900 mb-4"
          style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
        >
          SES Delivery Stats
        </h2>
        <SesDeliveryStatsSection />
      </section>

      {/* Email Delivery by Organisation */}
      <section>
        <EmailByOrgSection />
      </section>
    </div>
  );
}

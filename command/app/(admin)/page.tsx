'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { platformOverview, type OverviewResponse } from '@/lib/platform-api';

// ─── Plan display names ───────────────────────────────────────────────────────

const PLAN_DISPLAY: Record<string, string> = {
  foundation: 'Foundation',
  creator:    'Creator',
  studio:     'Studio',
  enterprise: 'Enterprise',
};

const PLAN_COLORS: Record<string, string> = {
  foundation: '#9CA3AF',
  creator:    '#0FA3B1',
  studio:     '#E67E22',
  enterprise: '#8B5CF6',
};

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  alertLevel?: 'warning';
}

function StatCard({ label, value, sub, alertLevel }: StatCardProps) {
  const containerClass =
    alertLevel === 'warning' ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200';

  return (
    <div className={`rounded-xl border shadow-sm p-6 ${containerClass}`}>
      <p
        className="text-xs uppercase tracking-widest text-gray-400 mb-1"
        style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
      >
        {label}
      </p>
      <p className="font-heading text-3xl font-bold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard({ height = 'h-28' }: { height?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${height}`} />;
}

// ─── Plan distribution donut ──────────────────────────────────────────────────

function PlanChart({ byPlan }: { byPlan: OverviewResponse['organizations']['by_plan'] }) {
  const data = Object.entries(byPlan)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      name: PLAN_DISPLAY[key] ?? key,
      value,
      fill: PLAN_COLORS[key] ?? '#6B7280',
    }));

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No organisations yet.</p>;
  }

  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [
              typeof value === 'number' ? value.toLocaleString() : String(value),
            ]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-4 mt-4 justify-center">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: entry.fill }}
            />
            <span
              className="text-xs text-gray-500"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              {entry.name} ({entry.value})
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Audit event row ──────────────────────────────────────────────────────────

function AuditRow({ event }: { event: OverviewResponse['recent_audit_events'][number] }) {
  const timeAgo = formatDistanceToNow(new Date(event.created_at), { addSuffix: true });
  return (
    <li className="flex items-start justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
      <div className="min-w-0 flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-900">
          {event.admin_name ?? 'system'}
        </span>
        <span
          className="text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded"
          style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
        >
          {event.action}
        </span>
        {event.organization_name && (
          <span className="text-xs text-gray-400">{event.organization_name}</span>
        )}
      </div>
      <span
        className="text-xs text-gray-400 shrink-0 whitespace-nowrap"
        style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
      >
        {timeAgo}
      </span>
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const { data: overview } = await platformOverview.get();
      setData(overview);
    } catch {
      setError('Failed to load overview data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  // ── Header ──
  const header = (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1
          className="text-2xl font-semibold text-gray-900"
          style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
        >
          Overview
        </h1>
        <p className="text-sm text-gray-500 mt-1">Platform health at a glance</p>
      </div>
      <button
        onClick={() => load(true)}
        disabled={loading || refreshing}
        className="min-h-[44px] min-w-[44px] flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-40"
        aria-label="Refresh"
      >
        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
      </button>
    </div>
  );

  if (loading) {
    return (
      <div>
        {header}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <SkeletonCard height="h-64" />
          <SkeletonCard height="h-64" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        {header}
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <span className="text-sm text-red-700">Failed to load overview data.</span>
          <button
            onClick={() => load()}
            className="ml-auto text-sm font-medium text-red-700 hover:underline min-h-[44px] px-2"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const mrrValue = data.mrr_cents
    ? '$' + (data.mrr_cents / 100).toFixed(2)
    : '—';
  const mrrSub = data.mrr_cents
    ? 'from active subscriptions'
    : (data.stripe_note ?? 'Stripe webhook not connected');

  return (
    <div>
      {header}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="ORGANISATIONS"
          value={data.organizations.total}
          sub={`${data.organizations.by_status?.active ?? 0} active`}
        />
        <StatCard
          label="ACTIVE USERS"
          value={data.users.active_30_days}
          sub={`+${data.users.new_7_days} new this week`}
        />
        <StatCard
          label="WORKSHOPS"
          value={data.workshops.by_status?.published ?? 0}
          sub={`${data.workshops.by_status?.draft ?? 0} in draft`}
        />
        <StatCard
          label="MRR"
          value={mrrValue}
          sub={mrrSub}
          alertLevel={!data.mrr_cents ? 'warning' : undefined}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* Plan distribution */}
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
          <h2
            className="text-base font-semibold text-gray-900 mb-4"
            style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
          >
            Organisations by Plan
          </h2>
          <PlanChart byPlan={data.organizations.by_plan} />
        </div>

        {/* Recent activity */}
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
          <h2
            className="text-base font-semibold text-gray-900 mb-4"
            style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
          >
            Recent Platform Activity
          </h2>
          {data.recent_audit_events.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              No recent platform activity.
            </p>
          ) : (
            <ul>
              {data.recent_audit_events.slice(0, 10).map((event) => (
                <AuditRow key={event.id} event={event} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

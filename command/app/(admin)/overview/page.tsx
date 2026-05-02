'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { platformOverview, type OverviewResponse } from '@/lib/platform-api';

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
  alertLevel?: 'warning';
}

function StatCard({ label, value, sub, alertLevel }: StatCardProps) {
  const containerClass = alertLevel === 'warning'
    ? 'bg-amber-50 border-amber-300'
    : 'bg-white border-gray-200';

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

// ─── Plan distribution donut ──────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  free:       '#9CA3AF',
  starter:    '#0FA3B1',
  pro:        '#7EA8BE',
  enterprise: '#E67E22',
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Free', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise',
};

function PlanChart({ byPlan }: { byPlan: OverviewResponse['organizations']['by_plan'] }) {
  const data = Object.entries(byPlan)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ name: PLAN_LABELS[key] ?? key, value, color: PLAN_COLORS[key] ?? '#6B7280' }));

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">No plan data yet.</p>;
  }

  return (
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
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [
            typeof value === 'number' ? value.toLocaleString() : String(value),
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ fontSize: 12, color: '#6B7280' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Workshop status bars ─────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-teal-500',
  draft:     'bg-gray-300',
  archived:  'bg-amber-400',
};

function WorkshopStatus({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  const statuses = ['published', 'draft', 'archived'];
  return (
    <ul className="space-y-3">
      {statuses.map((status) => {
        const count = byStatus[status] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <li key={status}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm capitalize text-gray-600">{status}</span>
              <span className="text-sm font-medium text-gray-800 font-mono">{count.toLocaleString()}</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${STATUS_COLORS[status] ?? 'bg-gray-400'} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Audit event row ──────────────────────────────────────────────────────────

function AuditRow({ event }: { event: OverviewResponse['recent_audit_events'][number] }) {
  const timeAgo = formatDistanceToNow(new Date(event.created_at), { addSuffix: true });
  return (
    <li className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 font-mono truncate">{event.action}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          {event.admin_name ?? 'system'}
          {event.organization_name ? ` · ${event.organization_name}` : ''}
        </p>
      </div>
      <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{timeAgo}</span>
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: overview } = await platformOverview.get();
      setData(overview);
    } catch {
      setError('Failed to load overview data. Check your connection and try again.');
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

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <AlertTriangle size={16} className="text-red-500 shrink-0" />
        <span className="text-sm text-red-700">Failed to load overview data.</span>
        <button
          onClick={load}
          className="ml-auto text-sm font-medium text-red-700 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold text-gray-900">Platform Overview</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Updated {formatDistanceToNow(new Date(data.generated_at), { addSuffix: true })}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

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
          sub={`+${data.users.new_7_days} this week`}
        />
        <StatCard
          label="WORKSHOPS"
          value={data.workshops.by_status?.published ?? 0}
          sub={`${data.workshops.by_status?.draft ?? 0} in draft`}
        />
        <StatCard
          label="BILLING"
          value="—"
          sub={data.stripe_note}
          alertLevel="warning"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Plan distribution */}
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
          <h3 className="font-heading text-sm font-semibold text-gray-800 mb-1">
            Plan Distribution
          </h3>
          {data.stripe_note && (
            <p className="text-xs text-amber-600 mb-3">{data.stripe_note}</p>
          )}
          <PlanChart byPlan={data.organizations.by_plan} />
        </div>

        {/* Workshop status */}
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
          <h3 className="font-heading text-sm font-semibold text-gray-800 mb-4">
            Workshop Status
          </h3>
          <WorkshopStatus
            byStatus={data.workshops.by_status}
            total={data.workshops.total}
          />

          {/* Org status */}
          <div className="mt-6">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              Organisation Status
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.organizations.by_status).map(([status, count]) => (
                <span
                  key={status}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
                >
                  <span className="capitalize">{status}</span>
                  <span className="font-medium font-mono">{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent audit events */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
        <h3 className="font-heading text-sm font-semibold text-gray-800 mb-4">
          Recent Platform Activity
        </h3>
        {data.recent_audit_events.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No recent activity.</p>
        ) : (
          <ul className="divide-y-0">
            {data.recent_audit_events.map((event) => (
              <AuditRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

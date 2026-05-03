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
import { AlertTriangle, CheckCircle, RefreshCw, ShieldCheck, ShieldAlert, Wrench } from 'lucide-react';
import {
  platformOverview,
  platformWorkshops,
  platformMaintenance,
  type OverviewResponse,
  type WorkshopReadinessItem,
  type MaintenanceStatus,
} from '@/lib/platform-api';

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

// ─── Score badge ─────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 80
    ? 'bg-teal-50 text-teal-700'
    : score >= 50
    ? 'bg-amber-50 text-amber-700'
    : 'bg-red-50 text-red-700';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
      style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
    >
      {score}
    </span>
  );
}

// ─── Workshop readiness section ───────────────────────────────────────────────

function WorkshopReadinessSection({ items }: { items: WorkshopReadinessItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 flex items-center gap-3">
        <CheckCircle size={24} className="text-[#0FA3B1] shrink-0" />
        <span className="text-sm text-gray-600">All draft workshops score 80+ — good shape!</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 pt-5 pb-3 flex items-start justify-between">
        <div>
          <h2
            className="text-base font-semibold text-gray-900"
            style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
          >
            Workshop Readiness
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Draft workshops sorted by readiness score (lowest first)
          </p>
        </div>
        <span className="text-sm text-[#0FA3B1]">View all →</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-gray-100 bg-gray-50">
              <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Organisation
              </th>
              <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Workshop
              </th>
              <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Missing Items
              </th>
              <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ready?
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.slice(0, 10).map((item) => {
              const missingText = item.missing_items.join(', ');
              const truncated = missingText.length > 60 ? missingText.slice(0, 60) + '…' : missingText;
              return (
                <tr key={item.workshop_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-sm text-gray-500">{item.organization_name ?? '—'}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{item.title}</td>
                  <td className="px-6 py-3"><ScoreBadge score={item.readiness_score} /></td>
                  <td className="px-6 py-3 text-sm text-gray-500">{truncated || '—'}</td>
                  <td className="px-6 py-3 text-sm font-medium">
                    {item.ready_to_publish
                      ? <span className="text-teal-600">Yes</span>
                      : <span className="text-red-500">No</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 2FA health widget ────────────────────────────────────────────────────────

interface Admin2faStats {
  total_admins: number;
  two_factor_on: number;
  two_factor_off: number;
}

function Admin2faWidget({ stats }: { stats: Admin2faStats }) {
  const allProtected = stats.two_factor_off === 0;

  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6">
      <h2
        className="text-sm font-semibold text-gray-900 mb-3"
        style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
      >
        Admin 2FA Coverage
      </h2>

      <p className="text-sm text-gray-600 mb-2">
        {stats.two_factor_on} of {stats.total_admins} admin{stats.total_admins !== 1 ? 's' : ''} have 2FA enabled
      </p>

      {allProtected ? (
        <div className="flex items-center gap-1.5 text-sm text-[#0FA3B1]">
          <ShieldCheck size={14} />
          All admin accounts are protected ✓
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm text-amber-600">
            <ShieldAlert size={14} />
            {stats.two_factor_off} admin account{stats.two_factor_off !== 1 ? 's' : ''} without 2FA
          </div>
          <a
            href="/settings"
            className="text-xs text-[#0FA3B1] hover:underline"
          >
            View in Settings →
          </a>
        </div>
      )}
    </div>
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
  const [readiness, setReadiness] = useState<WorkshopReadinessItem[]>([]);
  const [readinessLoaded, setReadinessLoaded] = useState(false);
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus | null>(null);
  const [maintenanceDisabling, setMaintenanceDisabling] = useState(false);
  const [maintenanceDisableError, setMaintenanceDisableError] = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const [overviewRes, readinessRes, maintenanceRes] = await Promise.allSettled([
      platformOverview.get(),
      platformWorkshops.readiness({ status: 'draft', max_score: 79 }),
      platformMaintenance.status(),
    ]);
    if (overviewRes.status === 'fulfilled') {
      setData(overviewRes.value.data);
    } else {
      setError('Failed to load overview data.');
    }
    if (readinessRes.status === 'fulfilled') {
      setReadiness(readinessRes.value.data.data);
    }
    if (maintenanceRes.status === 'fulfilled') {
      setMaintenanceStatus(maintenanceRes.value.data);
    }
    setReadinessLoaded(true);
    setLoading(false);
    setRefreshing(false);
  }

  async function handleDisableMaintenance() {
    setMaintenanceDisabling(true);
    setMaintenanceDisableError(false);
    try {
      await platformMaintenance.disable();
      const { data: status } = await platformMaintenance.status();
      setMaintenanceStatus(status);
    } catch {
      setMaintenanceDisableError(true);
    } finally {
      setMaintenanceDisabling(false);
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
        <div className="mt-4">
          <SkeletonCard height="h-40" />
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

      {/* Maintenance mode banner */}
      {maintenanceStatus?.maintenance_mode && (
        <div className="mb-6 rounded-2xl border-2 border-amber-400 bg-amber-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 flex items-start gap-3">
            <Wrench size={22} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-mono text-sm font-bold uppercase tracking-widest text-amber-800">
                Maintenance Mode Is Active
              </p>
              {maintenanceStatus.maintenance_message && (
                <p className="text-sm text-amber-700 mt-0.5">{maintenanceStatus.maintenance_message}</p>
              )}
              {maintenanceDisableError && (
                <p className="text-xs text-red-600 mt-1">Failed to disable — try again.</p>
              )}
            </div>
          </div>
          <button
            onClick={handleDisableMaintenance}
            disabled={maintenanceDisabling}
            className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#0FA3B1] rounded-lg hover:bg-[#0d8f9c] disabled:opacity-50 transition-colors shrink-0"
          >
            {maintenanceDisabling ? 'Disabling…' : 'Disable Maintenance Mode'}
          </button>
        </div>
      )}

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

      {/* 2FA Coverage + Workshop Readiness row */}
      {readinessLoaded && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <WorkshopReadinessSection items={readiness} />
          </div>
          {data.admin_2fa && (
            <div>
              <Admin2faWidget stats={data.admin_2fa} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

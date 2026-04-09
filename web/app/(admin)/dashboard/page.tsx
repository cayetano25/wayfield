'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LockedMetricCard } from '@/components/ui/LockedMetricCard';
import { StubMetricCard } from '@/components/ui/StubMetricCard';
import { getDashboardStats } from '@/lib/api/workshops';
import type { DashboardResponse } from '@/lib/types/dashboard';
import {
  formatRateWithColor,
  formatNoShowRateWithColor,
  formatCapacityUtilization,
  formatWeekLabel,
} from '@/lib/utils/metrics';
import {
  AlertCircle,
  Plus,
  PlusCircle,
  BarChart3,
  BookOpen,
  Users,
  Calendar,
  CheckSquare,
  DollarSign,
  Star,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const MONTH_NAME = new Date().toLocaleString('default', { month: 'long' });

// ── Shimmer / skeleton helpers ────────────────────────────────────────────────

function shimmerClass() {
  return 'shimmer rounded-xl';
}

function SkeletonKpiCard() {
  return (
    <div className={`${shimmerClass()} h-[120px]`} />
  );
}

function SkeletonChart({ height }: { height: number }) {
  return (
    <div className={`${shimmerClass()} w-full`} style={{ height }} />
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
}

function KpiCard({ label, value, sub, icon: Icon }: KpiCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-light-gray font-sans">
          {label}
        </p>
        <Icon className="w-4 h-4 text-light-gray" />
      </div>
      <p className="font-heading text-[32px] font-semibold text-dark leading-none mb-1">
        {value}
      </p>
      <p className="text-[13px] font-medium text-medium-gray">{sub}</p>
    </Card>
  );
}

// ── Coloured metric card (analytics) ─────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  valueColor: string;
  sub: string;
}

function MetricCard({ label, value, valueColor, sub }: MetricCardProps) {
  return (
    <Card className="p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-light-gray font-sans mb-3">
        {label}
      </p>
      <p
        className="font-heading text-[32px] font-semibold leading-none mb-1"
        style={{ color: valueColor }}
      >
        {value}
      </p>
      <p className="text-[13px] font-medium text-medium-gray">{sub}</p>
    </Card>
  );
}

// ── Plan usage bar ────────────────────────────────────────────────────────────

function PlanUsageBar({
  used,
  limit,
}: {
  used: number;
  limit: number | null;
}) {
  if (limit === null) {
    return (
      <p className="text-[13px] text-medium-gray">
        <span className="font-semibold text-dark">{used}</span> workshops · Unlimited plan
      </p>
    );
  }
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const atLimit = used >= limit;
  return (
    <div>
      <p className="text-[13px] text-medium-gray mb-2">
        <span className="font-semibold text-dark">{used}</span> / {limit} workshops used
      </p>
      <div className="w-full h-2 rounded-full bg-surface overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: atLimit ? '#E94F37' : '#0FA3B1',
          }}
        />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  useSetPage('Dashboard');
  const router = useRouter();
  const { currentOrg, isLoading: orgLoading } = useUser();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState(false);

  function fetchStats(orgId: number) {
    setLoadingStats(true);
    setError(false);
    getDashboardStats(orgId)
      .then((res) => setData(res))
      .catch(() => setError(true))
      .finally(() => setLoadingStats(false));
  }

  useEffect(() => {
    if (currentOrg) fetchStats(currentOrg.id);
  }, [currentOrg?.id]);

  const isLoading = orgLoading || loadingStats;

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (isLoading || (!data && !error)) {
    return (
      <>
        <style>{`
          .shimmer {
            background: linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%);
            background-size: 400% 100%;
            animation: shimmer 1.4s infinite;
          }
          @keyframes shimmer {
            0% { background-position: 100% 0; }
            100% { background-position: -100% 0; }
          }
        `}</style>
        <div className="max-w-[1280px] mx-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonKpiCard key={i} />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonKpiCard key={i} />)}
          </div>
          <SkeletonChart height={240} />
          <SkeletonChart height={280} />
        </div>
      </>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <Card className="p-8 flex flex-col items-center text-center gap-4">
          <AlertCircle className="w-10 h-10 text-danger" />
          <div>
            <p className="font-heading font-semibold text-dark mb-1">
              Could not load dashboard metrics
            </p>
            <p className="text-sm text-medium-gray">
              Check your connection and try again.
            </p>
          </div>
          <Button variant="secondary" onClick={() => currentOrg && fetchStats(currentOrg.id)}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const { core, analytics, stubs } = data;
  const planCode = core.plan.plan_code;
  const isPro = planCode === 'pro' || planCode === 'enterprise';
  const isStarter = planCode === 'starter' || isPro;
  const isFree = !isStarter;
  const showEmptyState = core.workshops.total === 0;

  // ── Row 2: analytics cards ────────────────────────────────────────────────
  let analyticsRow: React.ReactNode;
  if (isFree) {
    analyticsRow = (
      <>
        <LockedMetricCard label="Attendance Rate" previewValue="68%" availableOn="Starter" currentPlan={planCode} />
        <LockedMetricCard label="No-Show Rate"   previewValue="12%" availableOn="Starter" currentPlan={planCode} />
        <LockedMetricCard label="Capacity Use"   previewValue="45%" availableOn="Starter" currentPlan={planCode} />
      </>
    );
  } else {
    const am = analytics.attendance_metrics;
    const cm = analytics.capacity_metrics;
    const attendanceResult = formatRateWithColor(am?.attendance_rate ?? null);
    const noShowResult = formatNoShowRateWithColor(am?.no_show_rate ?? null);
    const util = cm?.capacity_utilization ?? null;

    analyticsRow = (
      <>
        <MetricCard
          label="Attendance Rate"
          value={attendanceResult.value}
          valueColor={attendanceResult.color}
          sub={am ? `${am.total_checked_in} of ${am.total_registered} attended` : 'No data'}
        />
        <MetricCard
          label="No-Show Rate"
          value={noShowResult.value}
          valueColor={noShowResult.color}
          sub={am ? `${am.total_no_show} participants did not attend` : 'No data'}
        />
        <MetricCard
          label="Capacity Utilization"
          value={formatCapacityUtilization(util)}
          valueColor={util !== null ? '#0FA3B1' : '#9CA3AF'}
          sub={
            util !== null && cm
              ? `${cm.total_enrolled_in_capacity_sessions} of ${cm.total_capacity_slots} slots filled`
              : 'No capacity limits set'
          }
        />
      </>
    );
  }

  // ── Row 3: registration trend ────────────────────────────────────────────
  let trendRow: React.ReactNode;
  if (!isPro) {
    trendRow = (
      <LockedMetricCard
        label="Registration Trend"
        previewValue="↑ 12%"
        availableOn="Pro"
        currentPlan={planCode}
        className="w-full"
      />
    );
  } else {
    const trend = analytics.registration_trend;
    const trendData = (trend ?? []).map((pt) => ({
      name: formatWeekLabel(pt.week_start),
      registrations: pt.registrations,
    }));
    const allZero = trendData.length > 0 && trendData.every((d) => d.registrations === 0);

    trendRow = (
      <Card className="p-6">
        <p className="font-heading font-semibold text-dark mb-4">
          Registrations — Last 12 Weeks
        </p>
        {allZero || trendData.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-medium-gray text-sm">
            No registrations in the past 12 weeks
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(value: number | string | readonly (number | string)[] | undefined) =>
                  [`${Array.isArray(value) ? value[0] : (value ?? 0)} registrations`, ''] as [string, string]
                }
                labelFormatter={(label: React.ReactNode) => `Week of ${label}`}
              />
              <Line
                type="monotone"
                dataKey="registrations"
                stroke="#0FA3B1"
                strokeWidth={2}
                dot={{ fill: '#0FA3B1', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    );
  }

  // ── Row 4: session breakdown ─────────────────────────────────────────────
  let sessionRow: React.ReactNode;
  if (isFree) {
    sessionRow = (
      <LockedMetricCard
        label="Session Attendance"
        previewValue="↑ sessions"
        availableOn="Starter"
        currentPlan={planCode}
        className="w-full"
      />
    );
  } else {
    const breakdown = analytics.session_breakdown ?? [];
    const barData = breakdown.map((s) => ({
      name: s.session_title.length > 20 ? `${s.session_title.slice(0, 20)}…` : s.session_title,
      enrolled: s.enrolled_count,
      checked_in: s.checked_in_count,
    }));

    sessionRow = (
      <Card className="p-6">
        <p className="font-heading font-semibold text-dark mb-4">Session Attendance</p>
        {barData.length === 0 ? (
          <div className="flex items-center justify-center h-[240px] text-medium-gray text-sm">
            No session data available yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} barSize={16} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(
                  value: number | string | readonly (number | string)[] | undefined,
                  name: number | string | undefined,
                ) => [
                  value ?? 0,
                  name === 'enrolled' ? 'Enrolled' : 'Checked In',
                ] as [number | string, string]}
              />
              <Legend formatter={(value: string) => value === 'enrolled' ? 'Enrolled' : 'Checked In'} />
              <Bar dataKey="enrolled"   fill="#0FA3B1" radius={[4, 4, 0, 0]} name="enrolled" />
              <Bar dataKey="checked_in" fill="#10B981" radius={[4, 4, 0, 0]} name="checked_in" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    );
  }

  return (
    <>
      <style>{`
        .shimmer {
          background: linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%);
          background-size: 400% 100%;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>

      <div className="max-w-[1280px] mx-auto space-y-6">

        {/* Row 1 — Core KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <KpiCard
            label="Total Workshops"
            value={core.workshops.total}
            sub={`${core.workshops.published} published · ${core.workshops.draft} draft`}
            icon={BookOpen}
          />
          <KpiCard
            label="Total Participants"
            value={core.participants.total_registered}
            sub="participants registered"
            icon={Users}
          />
          <KpiCard
            label="Sessions This Month"
            value={core.sessions_this_month.total}
            sub={`in ${MONTH_NAME}`}
            icon={Calendar}
          />
          <KpiCard
            label="Checked In Today"
            value={core.attendance.checked_in_today}
            sub="check-ins today"
            icon={CheckSquare}
          />
        </div>

        {/* Empty state — no workshops yet */}
        {showEmptyState && (
          <Card className="py-16 px-8 flex flex-col items-center text-center">
            <PlusCircle className="w-12 h-12 text-primary mb-4" />
            <h3 className="font-heading text-xl font-semibold text-dark mb-2">
              Create your first workshop to start seeing metrics
            </h3>
            <p className="text-sm text-medium-gray max-w-sm mb-8 leading-relaxed">
              Once you create and publish a workshop, your dashboard will fill with real data.
            </p>
            <Button size="lg" onClick={() => router.push('/admin/workshops/new')}>
              <Plus className="w-4 h-4" />
              Create Workshop
            </Button>
          </Card>
        )}

        {!showEmptyState && (
          <>
            {/* Row 2 — Analytics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {analyticsRow}
            </div>

            {/* Row 3 — Registration Trend */}
            {trendRow}

            {/* Row 4 — Session Attendance */}
            {sessionRow}
          </>
        )}

        {/* Row 5 — Stub cards (always shown) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StubMetricCard
            label={stubs.revenue?.label ?? 'Revenue'}
            description={stubs.revenue?.description ?? 'Revenue metrics coming soon.'}
            availableOn={stubs.revenue?.available_on ?? 'Pro'}
            icon={DollarSign}
          />
          <StubMetricCard
            label={stubs.satisfaction?.label ?? 'Satisfaction Score'}
            description={stubs.satisfaction?.description ?? 'Satisfaction metrics coming soon.'}
            availableOn={stubs.satisfaction?.available_on ?? 'Pro'}
            icon={Star}
          />
          <StubMetricCard
            label={stubs.engagement?.label ?? 'Engagement Score'}
            description={stubs.engagement?.description ?? 'Engagement metrics coming soon.'}
            availableOn={stubs.engagement?.available_on ?? 'Pro'}
            icon={Activity}
          />
        </div>

        {/* Row 6 — Quick Actions + Plan usage */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Button
              size="md"
              onClick={() => router.push('/admin/workshops/new')}
              className="sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              New Workshop
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.push('/admin/reports')}
              className="sm:w-auto"
            >
              <BarChart3 className="w-4 h-4" />
              View Reports
            </Button>
          </div>
          <PlanUsageBar
            used={core.workshops.total}
            limit={core.plan.workshops_limit}
          />
        </Card>

      </div>
    </>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LockedMetricCard } from '@/components/ui/LockedMetricCard';
import { StubMetricCard } from '@/components/ui/StubMetricCard';
import { getDashboardStats } from '@/lib/api/workshops';
import { apiGet } from '@/lib/api/client';
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
  Share2,
  MoreVertical,
  CalendarDays,
  UserRound,
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

// -- Shimmer / skeleton helpers ------------------------------------------------

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

// -- KPI card -----------------------------------------------------------------

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

// -- Coloured metric card (analytics) -----------------------------------------

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

// -- Plan usage bar ------------------------------------------------------------

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

// -- Next Up: workshop type ----------------------------------------------------

interface DashboardWorkshop {
  id: number;
  title: string;
  status: 'draft' | 'published' | 'archived';
  workshop_type: 'session_based' | 'event_based';
  start_date: string;
  end_date: string;
  sessions_count: number;
  participants_count: number;
  leaders_count?: number;
  header_image_url?: string | null;
  public_page_enabled?: boolean;
  join_code?: string;
}

// -- Date range formatter ------------------------------------------------------

function formatDateRange(start: string, end: string): string {
  if (!start) return '';
  const [sy, sm, sd] = start.split('-').map(Number);
  const endStr = end || start;
  const [ey, em, ed] = endStr.split('-').map(Number);

  const startDt = new Date(sy, sm - 1, sd);
  const endDt = new Date(ey, em - 1, ed);

  if (start === endStr) {
    return startDt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  if (sm === em && sy === ey) {
    return `${startDt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}–${ed}, ${sy}`;
  }
  return `${startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

// -- Stat cell (used in Next Up card) -----------------------------------------

function StatCell({
  icon: Icon,
  count,
  label,
}: {
  icon: React.ElementType;
  count: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-start gap-0.5 min-w-0">
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
      </div>
      <span className="font-heading text-[22px] font-bold text-dark leading-none">{count}</span>
      <span className="text-[11px] uppercase tracking-[0.06em] text-[#9CA3AF] font-sans font-medium">
        {label}
      </span>
    </div>
  );
}

// -- Next Up workshop card -----------------------------------------------------

function NextUpWorkshopCard({
  workshop,
  planParticipantsLimit,
}: {
  workshop: DashboardWorkshop;
  planParticipantsLimit: number | null;
}) {
  const dateLabel = formatDateRange(workshop.start_date, workshop.end_date);
  const deliveryLabel =
    workshop.workshop_type === 'session_based' ? 'SESSION-BASED' : 'EVENT-BASED';

  const utilization =
    planParticipantsLimit !== null && planParticipantsLimit > 0
      ? Math.min(100, Math.round((workshop.participants_count / planParticipantsLimit) * 100))
      : null;
  const atCapacityWarning = utilization !== null && utilization >= 90;

  const publicPageEnabled = workshop.public_page_enabled !== false;
  const publicHref = workshop.join_code ? `/w/${workshop.join_code}` : '#';

  return (
    <div
      className="bg-white overflow-hidden flex"
      style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minHeight: 180 }}
    >
      {/* Left image section — 40% */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{ width: '40%', minHeight: 180, borderRadius: '12px 0 0 12px' }}
      >
        {workshop.header_image_url ? (
          <img
            src={workshop.header_image_url}
            alt={workshop.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: 'linear-gradient(135deg, #0FA3B1 0%, #0891B2 100%)' }}
          />
        )}
        {/* Badge pills */}
        <div className="absolute bottom-3 left-3 flex gap-1.5">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: '#10B981' }}
          >
            PUBLISHED
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            {deliveryLabel}
          </span>
        </div>
      </div>

      {/* Right section — 60% */}
      <div className="flex-1 flex flex-col" style={{ padding: '20px 24px' }}>
        {/* Top row: title + action buttons */}
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <h3
            className="font-heading font-bold text-dark leading-snug"
            style={{ fontSize: 20 }}
          >
            {workshop.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              className="flex items-center justify-center text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
              style={{ width: 32, height: 32, border: '1px solid #E5E7EB', borderRadius: 8 }}
              title="Share workshop"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="flex items-center justify-center text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
              style={{ width: 32, height: 32, border: '1px solid #E5E7EB', borderRadius: 8 }}
              title="More options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Date row */}
        <div className="flex items-center gap-1.5" style={{ marginTop: 6 }}>
          <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: '#9CA3AF' }} />
          <span className="font-sans text-[13px]" style={{ color: '#6B7280' }}>{dateLabel}</span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-6" style={{ marginTop: 16 }}>
          <StatCell icon={Users} count={workshop.participants_count} label="Participants" />
          <div className="bg-[#F3F4F6]" style={{ width: 1, height: 32, flexShrink: 0 }} />
          <StatCell icon={CalendarDays} count={workshop.sessions_count} label="Sessions" />
          <div className="bg-[#F3F4F6]" style={{ width: 1, height: 32, flexShrink: 0 }} />
          <StatCell icon={UserRound} count={workshop.leaders_count ?? 0} label="Leaders" />
        </div>

        {/* Capacity row */}
        {utilization !== null && (
          <div style={{ marginTop: 16 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <span
                className="font-sans font-semibold uppercase"
                style={{ fontSize: 10, letterSpacing: '0.08em', color: '#9CA3AF' }}
              >
                Current Capacity
              </span>
              <span className="font-sans font-semibold" style={{ fontSize: 12, color: '#0FA3B1' }}>
                {utilization}% Full
              </span>
            </div>
            <div
              className="overflow-hidden"
              style={{ height: 6, backgroundColor: '#F3F4F6', borderRadius: 9999 }}
            >
              <div
                style={{
                  width: `${utilization}%`,
                  height: '100%',
                  borderRadius: 9999,
                  backgroundColor: atCapacityWarning ? '#E67E22' : '#0FA3B1',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Button row */}
        <div className="flex items-center gap-3" style={{ marginTop: 20 }}>
          <Link href={`/workshops/${workshop.id}`}>
            <Button size="md">Manage Workshop</Button>
          </Link>
          {publicPageEnabled ? (
            <a href={publicHref} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="md">View Public Page</Button>
            </a>
          ) : (
            <Button
              variant="secondary"
              size="md"
              disabled
              title="Enable public page in workshop settings"
            >
              View Public Page
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// -- Next Up section (loading / empty / loaded) --------------------------------

function NextUpSection({
  nextUp,
  loading,
  planParticipantsLimit,
  onNewWorkshop,
}: {
  nextUp: DashboardWorkshop | null | undefined;
  loading: boolean;
  planParticipantsLimit: number | null;
  onNewWorkshop: () => void;
}) {
  return (
    <div>
      {/* Section label */}
      <div className="flex items-center gap-3 mb-3">
        <span
          className="font-sans font-bold uppercase"
          style={{ fontSize: 10, letterSpacing: '0.08em', color: '#9CA3AF' }}
        >
          Next Up
        </span>
        <div className="flex-1 h-px bg-[#F3F4F6]" />
      </div>

      {loading || nextUp === undefined ? (
        <div className={`${shimmerClass()} h-[220px]`} />
      ) : nextUp === null ? (
        /* CTA — no published workshops */
        <Card className="py-14 px-8 flex flex-col items-center text-center">
          <PlusCircle className="w-12 h-12 text-primary mb-4" />
          <h3 className="font-heading text-xl font-semibold text-dark mb-2">
            Create your first workshop to start seeing metrics
          </h3>
          <p className="text-sm text-medium-gray max-w-sm mb-8 leading-relaxed">
            Once you create and publish a workshop, your dashboard will fill with real data.
          </p>
          <Button size="lg" onClick={onNewWorkshop}>
            <Plus className="w-4 h-4" />
            Create Workshop
          </Button>
        </Card>
      ) : (
        <NextUpWorkshopCard workshop={nextUp} planParticipantsLimit={planParticipantsLimit} />
      )}
    </div>
  );
}

// -- Workshops list — row ------------------------------------------------------

function WorkshopRow({ workshop }: { workshop: DashboardWorkshop }) {
  const initials = workshop.title.slice(0, 2).toUpperCase();
  const dateLabel = formatDateRange(workshop.start_date, workshop.end_date);
  const displayTitle =
    workshop.title.length > 24 ? `${workshop.title.slice(0, 24)}…` : workshop.title;

  const now = new Date();
  const startDate = workshop.start_date
    ? (() => {
        const [y, m, d] = workshop.start_date.split('-').map(Number);
        return new Date(y, m - 1, d);
      })()
    : null;

  let statusLabel: string;
  let statusBg: string;
  let statusText: string;

  if (workshop.status === 'draft') {
    statusLabel = 'DRAFT';
    statusBg = '#F3F4F6';
    statusText = '#6B7280';
  } else if (workshop.status === 'archived') {
    statusLabel = 'ARCHIVED';
    statusBg = '#F3F4F6';
    statusText = '#9CA3AF';
  } else if (startDate && startDate > now) {
    statusLabel = 'UPCOMING';
    statusBg = '#EFF6FF';
    statusText = '#3B82F6';
  } else {
    statusLabel = 'LIVE';
    statusBg = '#ECFDF5';
    statusText = '#10B981';
  }

  return (
    <div className="flex items-center gap-3" style={{ padding: '10px 0' }}>
      {/* Avatar */}
      <div
        className="shrink-0 flex items-center justify-center font-heading font-bold text-white"
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          fontSize: 14,
          background: 'linear-gradient(135deg, #0FA3B1 0%, #0891B2 100%)',
        }}
      >
        {initials}
      </div>

      {/* Title + date */}
      <div className="flex-1 min-w-0">
        <p className="font-sans text-sm font-medium text-dark truncate">{displayTitle}</p>
        <p className="font-sans text-xs" style={{ color: '#6B7280' }}>{dateLabel}</p>
      </div>

      {/* Right: count + label + badge */}
      <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
        <p className="font-sans font-semibold text-dark" style={{ fontSize: 13 }}>
          {workshop.participants_count}
        </p>
        <p
          className="font-sans font-medium uppercase"
          style={{ fontSize: 9, letterSpacing: '0.06em', color: '#9CA3AF' }}
        >
          MEMBERS
        </p>
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded-full font-sans font-semibold"
          style={{ fontSize: 9, backgroundColor: statusBg, color: statusText }}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

// -- Workshops list card -------------------------------------------------------

function WorkshopsList({
  workshops,
  loading,
}: {
  workshops: DashboardWorkshop[];
  loading: boolean;
}) {
  return (
    <Card className="p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <span className="font-heading text-base font-semibold text-dark">Workshops</span>
        <Link
          href="/workshops"
          className="font-sans text-[13px] hover:underline"
          style={{ color: '#0FA3B1' }}
        >
          View All →
        </Link>
      </div>

      {loading ? (
        <div className="flex-1 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${shimmerClass()} h-12`} />
          ))}
        </div>
      ) : workshops.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-sans text-[13px] text-medium-gray text-center">No workshops yet</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          {workshops.map((w, i) => (
            <div key={w.id}>
              <WorkshopRow workshop={w} />
              {i < workshops.length - 1 && (
                <div style={{ height: 1, backgroundColor: '#F9FAFB' }} />
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// -- Main page -----------------------------------------------------------------

export default function DashboardPage() {
  useSetPage('Dashboard');
  const router = useRouter();
  const { currentOrg, isLoading: orgLoading } = useUser();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState(false);

  const [nextUpWorkshop, setNextUpWorkshop] = useState<DashboardWorkshop | null | undefined>(undefined);
  const [recentWorkshops, setRecentWorkshops] = useState<DashboardWorkshop[]>([]);
  const [loadingWorkshops, setLoadingWorkshops] = useState(false);

  function fetchStats(orgId: number) {
    setLoadingStats(true);
    setError(false);
    getDashboardStats(orgId)
      .then((res) => setData(res))
      .catch(() => setError(true))
      .finally(() => setLoadingStats(false));
  }

  function fetchWorkshops(orgId: number) {
    setLoadingWorkshops(true);
    apiGet<DashboardWorkshop[]>(`/organizations/${orgId}/workshops`)
      .then((workshops) => {
        const list = workshops ?? [];
        // Next Up: most imminent published workshop
        const nextUp = list
          .filter((w) => w.status === 'published')
          .sort(
            (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
          )[0] ?? null;
        setNextUpWorkshop(nextUp);
        // Recent list: sorted by start_date DESC, max 4
        const recent = [...list]
          .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
          .slice(0, 4);
        setRecentWorkshops(recent);
      })
      .catch(() => {
        setNextUpWorkshop(null);
        setRecentWorkshops([]);
      })
      .finally(() => setLoadingWorkshops(false));
  }

  useEffect(() => {
    if (currentOrg) {
      fetchStats(currentOrg.id);
      fetchWorkshops(currentOrg.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  const isLoading = orgLoading || loadingStats;

  // -- Skeleton --------------------------------------------------------------
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

  // -- Error -----------------------------------------------------------------
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

  // -- Row 2: analytics cards ------------------------------------------------
  let analyticsRow: React.ReactNode;
  if (isFree) {
    analyticsRow = (
      <>
        <LockedMetricCard label="Attendance Rate" previewValue="68%" availableOn="Creator" currentPlan={planCode} />
        <LockedMetricCard label="No-Show Rate"   previewValue="12%" availableOn="Creator" currentPlan={planCode} />
        <LockedMetricCard label="Capacity Use"   previewValue="45%" availableOn="Creator" currentPlan={planCode} />
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

  // -- Row 3: registration trend --------------------------------------------
  let trendRow: React.ReactNode;
  if (!isPro) {
    trendRow = (
      <LockedMetricCard
        label="Registration Trend"
        previewValue="↑ 12%"
        availableOn="Studio"
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

  // -- Row 4: session breakdown (left 60%) ----------------------------------
  let sessionChart: React.ReactNode;
  if (isFree) {
    sessionChart = (
      <LockedMetricCard
        label="Session Attendance"
        previewValue="↑ sessions"
        availableOn="Creator"
        currentPlan={planCode}
        className="w-full h-full"
      />
    );
  } else {
    const breakdown = analytics.session_breakdown ?? [];
    const barData = breakdown.map((s) => ({
      name: s.session_title.length > 20 ? `${s.session_title.slice(0, 20)}…` : s.session_title,
      enrolled: s.enrolled_count,
      checked_in: s.checked_in_count,
    }));

    sessionChart = (
      <Card className="p-6 h-full">
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

        {/* Next Up — between Row 1 and analytics */}
        <NextUpSection
          nextUp={nextUpWorkshop}
          loading={loadingWorkshops}
          planParticipantsLimit={core.plan.participants_limit}
          onNewWorkshop={() => router.push('/workshops/new')}
        />

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

            {/* Row 4 — Session Attendance (60%) + Workshops list (40%) */}
            <div className="grid gap-6" style={{ gridTemplateColumns: '60% 1fr' }}>
              {sessionChart}
              <WorkshopsList workshops={recentWorkshops} loading={loadingWorkshops} />
            </div>
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
              onClick={() => router.push('/reports')}
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

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getDashboardStats, type DashboardStats } from '@/lib/api/workshops';
import { CalendarDays, Plus, AlertCircle, BarChart3 } from 'lucide-react';

const MONTH_NAME = new Date().toLocaleString('default', { month: 'long' });

function SkeletonCard() {
  return (
    <Card className="p-6">
      <div className="h-3 w-24 bg-surface rounded animate-pulse mb-4" />
      <div className="h-9 w-20 bg-surface rounded animate-pulse mb-2" />
      <div className="h-3 w-36 bg-surface rounded animate-pulse" />
    </Card>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <Card className="p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-light-gray font-sans mb-3">
        {label}
      </p>
      <p className="font-heading text-[32px] font-semibold text-dark leading-none mb-1">
        {value}
      </p>
      <p className="text-[13px] font-medium text-medium-gray">{sub}</p>
    </Card>
  );
}

export default function DashboardPage() {
  useSetPage('Dashboard');
  const router = useRouter();
  const { currentOrg, isLoading: orgLoading } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState(false);

  function fetchStats(orgId: number) {
    setLoadingStats(true);
    setError(false);
    getDashboardStats(orgId)
      .then((data) => setStats(data))
      .catch(() => setError(true))
      .finally(() => setLoadingStats(false));
  }

  useEffect(() => {
    if (currentOrg) fetchStats(currentOrg.id);
  }, [currentOrg?.id]);

  const isLoading = orgLoading || loadingStats;

  // ── Skeleton state ────────────────────────────────────────────────────────
  if (isLoading || (!stats && !error)) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error || !stats) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <Card className="p-8 flex flex-col items-center text-center gap-4">
          <AlertCircle className="w-10 h-10 text-danger" />
          <div>
            <p className="font-heading font-semibold text-dark mb-1">
              Failed to load dashboard
            </p>
            <p className="text-sm text-medium-gray">
              There was a problem fetching your stats. Please try again.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => currentOrg && fetchStats(currentOrg.id)}
          >
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  const { workshops, participants, sessions_this_month, attendance, plan } = stats;

  // Plan badge variant
  const planVariant = (
    ['free', 'starter', 'pro', 'enterprise'].includes(plan.plan_code)
      ? `plan-${plan.plan_code}`
      : 'plan-free'
  ) as 'plan-free' | 'plan-starter' | 'plan-pro' | 'plan-enterprise';

  const planUsage =
    plan.workshops_limit !== null
      ? `${workshops.total} / ${plan.workshops_limit} workshops used`
      : 'Unlimited';

  const showEmptyState = workshops.total === 0;

  return (
    <div className="max-w-[1280px] mx-auto">
      {/* Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard
          label="Total Workshops"
          value={workshops.total}
          sub={`${workshops.published} published · ${workshops.draft} draft`}
        />
        <StatCard
          label="Total Participants"
          value={participants.total}
          sub="registered across all workshops"
        />
        <StatCard
          label="Sessions This Month"
          value={sessions_this_month.total}
          sub={`published sessions in ${MONTH_NAME}`}
        />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard
          label="Checked In Today"
          value={attendance.checked_in_today}
          sub="attendance recorded today"
        />

        {/* Plan card */}
        <Card className="p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-light-gray font-sans mb-3">
            Plan
          </p>
          <div className="flex items-center gap-2 mb-1">
            <p className="font-heading text-[32px] font-semibold text-dark leading-none capitalize">
              {plan.plan_code}
            </p>
            <Badge variant={planVariant} />
          </div>
          <p className="text-[13px] font-medium text-medium-gray">{planUsage}</p>
        </Card>

        {/* Quick Actions card */}
        <Card className="p-6 flex flex-col justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-light-gray font-sans">
            Quick Actions
          </p>
          <div className="flex flex-col gap-3">
            <Button
              size="md"
              onClick={() => router.push('/admin/workshops/new')}
              className="w-full justify-center"
            >
              <Plus className="w-4 h-4" />
              New Workshop
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.push('/admin/reports')}
              className="w-full justify-center"
            >
              <BarChart3 className="w-4 h-4" />
              View Reports
            </Button>
          </div>
        </Card>
      </div>

      {/* Empty state — only when zero workshops */}
      {showEmptyState && (
        <Card className="py-20 px-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-surface border border-border-gray flex items-center justify-center mb-6">
            <CalendarDays className="w-9 h-9 text-light-gray" />
          </div>
          <h3 className="font-heading text-xl font-semibold text-dark mb-2">
            Get started — Create your first workshop
          </h3>
          <p className="text-sm text-medium-gray max-w-sm mb-8 leading-relaxed">
            Organize sessions, invite leaders, manage participants, and track
            attendance — all in one place.
          </p>
          <Button size="lg" onClick={() => router.push('/admin/workshops/new')}>
            <Plus className="w-4 h-4" />
            Create workshop
          </Button>
        </Card>
      )}
    </div>
  );
}

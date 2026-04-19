'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Copy, Check, CalendarDays, Users, AlertCircle } from 'lucide-react';
import { ShareWorkshopButton } from '@/components/workshops/ShareWorkshopButton';
import toast from 'react-hot-toast';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { getWorkshops } from '@/lib/api/workshops';
import { getEntitlements, type Entitlements } from '@/lib/api/reports';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface WorkshopSummary {
  id: number;
  title: string;
  workshop_type: 'session_based' | 'event_based';
  status: 'draft' | 'published' | 'archived';
  start_date: string;
  end_date: string;
  join_code: string;
  public_slug?: string | null;
  sessions_count: number;
  participants_count: number;
}

type StatusFilter = 'all' | 'published' | 'draft' | 'archived';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const FILTER_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Published', value: 'published' },
  { label: 'Draft', value: 'draft' },
  { label: 'Archived', value: 'archived' },
];

export default function WorkshopsPage() {
  useSetPage('Workshops');

  const { currentOrg } = useUser();
  const [workshops, setWorkshops] = useState<WorkshopSummary[]>([]);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  function loadData(orgId: number) {
    setLoading(true);
    setError(false);
    Promise.all([
      getWorkshops(orgId) as Promise<WorkshopSummary[]>,
      getEntitlements(orgId),
    ])
      .then(([ws, ent]) => {
        setWorkshops(ws ?? []);
        setEntitlements(ent);
      })
      .catch(() => {
        setError(true);
        toast.error('Failed to load workshops');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!currentOrg) return;
    loadData(currentOrg.id);
  }, [currentOrg?.id]);

  const filtered = workshops.filter(
    (w) => statusFilter === 'all' || w.status === statusFilter,
  );

  // Plan usage from entitlements API
  const workshopLimit = entitlements?.limits?.max_active_workshops ?? null;
  const workshopUsed  = entitlements?.usage?.active_workshop_count ?? workshops.filter((w) => w.status !== 'archived').length;
  const planCode      = entitlements?.plan ?? currentOrg?.plan_code ?? 'free';
  const atLimit       = workshopLimit !== null && workshopUsed >= workshopLimit;

  async function copyJoinCode(e: React.MouseEvent, workshop: WorkshopSummary) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(workshop.join_code);
      setCopiedId(workshop.id);
      toast.success('Join code copied');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  const newButton = (
    <Button>
      <Plus className="w-4 h-4" />
      {atLimit ? 'Upgrade plan' : 'New Workshop'}
    </Button>
  );

  // Error state
  if (error && !loading) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <Card className="p-8 flex flex-col items-center text-center gap-4">
          <AlertCircle className="w-10 h-10 text-danger" />
          <div>
            <p className="font-heading font-semibold text-dark mb-1">Failed to load workshops</p>
            <p className="text-sm text-medium-gray">There was a problem fetching your workshops. Please try again.</p>
          </div>
          <Button variant="secondary" onClick={() => currentOrg && loadData(currentOrg.id)}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div />
        <div className="flex flex-col items-end gap-2">
          {atLimit ? (
            <Link href="/organization/billing">{newButton}</Link>
          ) : (
            <Link href="/workshops/new">{newButton}</Link>
          )}
          {workshopLimit !== null && (
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end mb-1">
                <span className="text-xs text-medium-gray">
                  {workshopUsed}/{workshopLimit} active workshops
                </span>
                <span className="text-xs font-medium text-primary capitalize">{planCode}</span>
              </div>
              <div className="w-48 h-1.5 bg-surface rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${atLimit ? 'bg-danger' : 'bg-primary'}`}
                  style={{ width: `${Math.min((workshopUsed / workshopLimit) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
          {workshopLimit === null && planCode !== 'free' && (
            <span className="text-xs text-medium-gray capitalize">{planCode} · Unlimited</span>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-border-gray">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`
              px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${statusFilter === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-medium-gray hover:text-dark'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-52 bg-white rounded-xl border border-border-gray animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="py-20 px-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-surface border border-border-gray flex items-center justify-center mb-5">
            <CalendarDays className="w-7 h-7 text-light-gray" />
          </div>
          <h3 className="font-heading text-lg font-semibold text-dark mb-2">
            {statusFilter === 'all' ? 'No workshops yet' : `No ${statusFilter} workshops`}
          </h3>
          <p className="text-sm text-medium-gray max-w-xs mb-7 leading-relaxed">
            {statusFilter === 'all'
              ? 'Create your first workshop to get started.'
              : `You don't have any ${statusFilter} workshops.`}
          </p>
          {statusFilter === 'all' && (
            <Link href={atLimit ? '/organization/billing' : '/workshops/new'}>
              <Button>
                <Plus className="w-4 h-4" />
                {atLimit ? 'Upgrade plan' : 'Create workshop'}
              </Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((workshop) => (
            <Link key={workshop.id} href={`/workshops/${workshop.id}`} className="block group">
              <Card
                interactive
                className="p-5 h-full transition-all group-hover:shadow-[0px_16px_40px_rgba(46,46,46,0.10)] group-hover:-translate-y-0.5"
              >
                {/* Badges */}
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={`type-${workshop.workshop_type}`} />
                  <Badge variant={`status-${workshop.status}`} />
                </div>

                {/* Title */}
                <h3 className="font-heading text-base font-semibold text-dark mb-2 line-clamp-2 leading-snug">
                  {workshop.title}
                </h3>

                {/* Date range */}
                <p className="text-xs text-medium-gray mb-4">
                  {formatDate(workshop.start_date)}
                  {workshop.end_date && workshop.end_date !== workshop.start_date
                    ? ` — ${formatDate(workshop.end_date)}`
                    : ''}
                </p>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-light-gray mb-4">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {workshop.sessions_count ?? 0} sessions
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {workshop.participants_count ?? 0} participants
                  </span>
                </div>

                {/* Join code */}
                <div className="flex items-center gap-2 pt-3 border-t border-border-gray">
                  <code className="font-mono text-xs text-medium-gray tracking-wider flex-1 truncate">
                    {workshop.join_code}
                  </code>
                  <button
                    type="button"
                    onClick={(e) => copyJoinCode(e, workshop)}
                    className="p-1.5 rounded-md text-light-gray hover:text-primary hover:bg-primary/5 transition-colors"
                    title="Copy join code"
                  >
                    {copiedId === workshop.id ? (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {workshop.status === 'published' && workshop.public_slug && (
                    <ShareWorkshopButton
                      workshopTitle={workshop.title}
                      publicUrl={`/w/${workshop.public_slug}`}
                      variant="participant"
                    />
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

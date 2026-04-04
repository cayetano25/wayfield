'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ExternalLink, FileText, ArrowUpRight } from 'lucide-react';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet, apiPost, ApiError } from '@/lib/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface PlanLimits {
  max_workshops: number | null;
  max_participants_per_workshop: number | null;
  max_managers: number | null;
}

interface PlanUsage {
  active_workshops: number;
  total_participants: number;
  managers: number;
}

interface Invoice {
  id: string;
  amount_cents: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  period_start: string;
  period_end: string;
  paid_at: string | null;
  pdf_url: string | null;
}

interface SubscriptionData {
  plan_code: 'free' | 'starter' | 'pro' | 'enterprise';
  plan_name: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  current_period_start: string | null;
  current_period_end: string | null;
  renewal_date: string | null;
  limits: PlanLimits;
  usage: PlanUsage;
  invoices: Invoice[];
}

const BILLING_ROLES = ['owner', 'billing_admin'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function formatCurrency(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

interface UsageBarProps {
  label: string;
  used: number;
  max: number | null;
}

function UsageBar({ label, used, max }: UsageBarProps) {
  const unlimited = max === null;
  const pct = unlimited ? 0 : Math.min((used / max) * 100, 100);

  const fillClass =
    pct >= 100 || pct >= 90
      ? 'bg-danger'
      : pct >= 75
      ? 'bg-secondary'
      : 'bg-primary';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-dark font-medium">{label}</span>
        <span className="text-sm text-medium-gray font-mono">
          {used}
          {unlimited ? '' : ` / ${max}`}
          {unlimited && <span className="text-xs ml-1 text-light-gray">unlimited</span>}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 bg-surface rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${fillClass}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function invoiceStatusVariant(status: Invoice['status']): 'status-active' | 'status-draft' | 'status-archived' {
  if (status === 'paid') return 'status-active';
  if (status === 'open') return 'status-draft';
  return 'status-archived';
}

const UPGRADE_MAP: Partial<Record<string, { label: string; target: string }>> = {
  free: { label: 'Upgrade to Starter', target: 'starter' },
  starter: { label: 'Upgrade to Pro', target: 'pro' },
};

export default function OrganizationBillingPage() {
  useSetPage('Billing', [
    { label: 'Organization' },
    { label: 'Billing' },
  ]);

  const { currentOrg } = useUser();
  const role = currentOrg?.role ?? '';
  const canAccess = BILLING_ROLES.includes(role);

  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    if (!canAccess) {
      setLoading(false);
      return;
    }
    apiGet<SubscriptionData>(`/organizations/${currentOrg.id}/subscription`)
      .then((res) => setData(res))
      .catch(() => toast.error('Failed to load billing information'))
      .finally(() => setLoading(false));
  }, [currentOrg, canAccess]);

  async function handleUpgrade() {
    if (!currentOrg) return;
    setUpgradeLoading(true);
    try {
      const res = await apiPost<{ checkout_url: string }>(
        `/organizations/${currentOrg.id}/billing/checkout`,
      );
      window.location.href = res.checkout_url;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not start checkout');
      setUpgradeLoading(false);
    }
  }

  async function handleManage() {
    if (!currentOrg) return;
    setPortalLoading(true);
    try {
      const res = await apiPost<{ portal_url: string }>(
        `/organizations/${currentOrg.id}/billing/portal`,
      );
      window.location.href = res.portal_url;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not open billing portal');
      setPortalLoading(false);
    }
  }

  if (!canAccess) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <Card className="py-20 px-8 flex flex-col items-center text-center">
          <p className="text-medium-gray text-sm">
            You don&apos;t have permission to view billing information.
          </p>
        </Card>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="max-w-[1280px] mx-auto space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-8">
            <div className="h-24 bg-surface rounded-lg animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  const upgrade = UPGRADE_MAP[data.plan_code];
  const hasSubscription = data.plan_code !== 'free';

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      {/* Current plan */}
      <Card>
        <div className="px-6 py-5 border-b border-border-gray">
          <h2 className="font-heading text-base font-semibold text-dark">Current Plan</h2>
        </div>
        <div className="px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge variant={`plan-${data.plan_code}` as `plan-${typeof data.plan_code}`}>
                {data.plan_name}
              </Badge>
              <Badge
                variant={data.status === 'active' || data.status === 'trialing' ? 'status-active' : 'status-archived'}
              >
                {data.status.replace('_', ' ')}
              </Badge>
            </div>
            {data.current_period_start && data.current_period_end && (
              <p className="text-sm text-medium-gray">
                Current period:{' '}
                <span className="text-dark">
                  {formatDate(data.current_period_start)} – {formatDate(data.current_period_end)}
                </span>
              </p>
            )}
            {data.renewal_date && (
              <p className="text-sm text-medium-gray">
                Renews on:{' '}
                <span className="text-dark font-medium">{formatDate(data.renewal_date)}</span>
              </p>
            )}
          </div>
          {hasSubscription && (
            <Button variant="secondary" onClick={handleManage} loading={portalLoading}>
              <ExternalLink className="w-4 h-4" />
              Manage billing
            </Button>
          )}
        </div>
      </Card>

      {/* Usage */}
      <Card>
        <div className="px-6 py-5 border-b border-border-gray">
          <h2 className="font-heading text-base font-semibold text-dark">Usage</h2>
        </div>
        <div className="px-6 py-6 space-y-5">
          <UsageBar
            label="Active Workshops"
            used={data.usage.active_workshops}
            max={data.limits.max_workshops}
          />
          <UsageBar
            label="Participants (per workshop)"
            used={data.usage.total_participants}
            max={data.limits.max_participants_per_workshop}
          />
          <UsageBar
            label="Organization Managers"
            used={data.usage.managers}
            max={data.limits.max_managers}
          />
        </div>
      </Card>

      {/* Upgrade CTA */}
      {upgrade && (
        <Card>
          <div className="px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-heading text-base font-semibold text-dark mb-1">
                Ready to grow?
              </h2>
              <p className="text-sm text-medium-gray">
                Unlock more workshops, participants, and advanced features.
              </p>
            </div>
            <Button onClick={handleUpgrade} loading={upgradeLoading}>
              <ArrowUpRight className="w-4 h-4" />
              {upgrade.label}
            </Button>
          </div>
        </Card>
      )}

      {/* Invoice history */}
      {data.invoices && data.invoices.length > 0 && (
        <Card>
          <div className="px-6 py-5 border-b border-border-gray">
            <h2 className="font-heading text-base font-semibold text-dark">Invoice History</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-gray">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-light-gray">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-light-gray hidden sm:table-cell">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-light-gray hidden md:table-cell">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-light-gray hidden lg:table-cell">
                  Paid
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-widest text-light-gray">
                  PDF
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-gray">
              {data.invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-dark font-mono">
                      {formatCurrency(invoice.amount_cents, invoice.currency)}
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <Badge variant={invoiceStatusVariant(invoice.status)}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-sm text-medium-gray">
                      {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <span className="text-sm text-medium-gray">{formatDate(invoice.paid_at)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {invoice.pdf_url ? (
                      <a
                        href={invoice.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        PDF
                      </a>
                    ) : (
                      <span className="text-sm text-light-gray">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

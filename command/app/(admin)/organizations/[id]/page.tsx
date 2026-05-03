'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ChevronDown, ChevronRight, CheckCircle, XCircle, ExternalLink, Layers } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  platformOrganizations,
  platformAuditLogs,
  platformPayments,
  platformWorkshops,
  type OrgDetail,
  type FeatureFlag,
  type PlatformAuditLog,
  type PlanCode,
  type OrgPaymentStatus,
  type WorkshopPricingItem,
  type AddonSessionPricing,
} from '@/lib/platform-api';
import { useAdminUser, can } from '@/contexts/AdminUserContext';
import { useToast } from '@/components/ui/Toast';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PlanBadge } from '@/components/ui/PlanBadge';
import { UsageBar } from '@/components/ui/UsageBar';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Table, TableHead, Th, TableBody, Td } from '@/components/ui/Table';

const TABS = ['overview', 'billing', 'flags', 'usage', 'payments', 'workshops', 'audit'] as const;
type Tab = (typeof TABS)[number];

const PLAN_OPTIONS: Array<{ value: PlanCode; label: string }> = [
  { value: 'foundation', label: 'Foundation' },
  { value: 'creator', label: 'Creator' },
  { value: 'studio', label: 'Studio' },
  { value: 'enterprise', label: 'Enterprise' },
];

// ─── Plan change modal ────────────────────────────────────────────────────────

interface PlanChangeModalProps {
  orgId: number;
  currentPlan: PlanCode | null;
  onClose: () => void;
  onSuccess: () => void;
}

function PlanChangeModal({ orgId, currentPlan, onClose, onSuccess }: PlanChangeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>(currentPlan ?? 'foundation');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const isDowngrade =
    currentPlan &&
    PLAN_OPTIONS.findIndex((p) => p.value === selectedPlan) <
      PLAN_OPTIONS.findIndex((p) => p.value === currentPlan);

  async function handleConfirm() {
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await platformOrganizations.changePlan(orgId, selectedPlan, reason);
      toast(`Plan changed to ${selectedPlan}.`, 'success');
      onSuccess();
    } catch {
      setError('Failed to change plan. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="font-heading text-lg font-semibold text-gray-900 mb-4">Change Plan</h2>

        <div className="space-y-3 mb-4">
          {PLAN_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors min-h-[44px]"
            >
              <input
                type="radio"
                name="plan"
                value={opt.value}
                checked={selectedPlan === opt.value}
                onChange={() => setSelectedPlan(opt.value)}
                className="text-[#0FA3B1] focus:ring-[#0FA3B1]"
              />
              <PlanBadge plan={opt.value} />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>

        {isDowngrade && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-2">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              Downgrading may remove access to features the organisation currently uses.
            </p>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Why is this plan being changed?"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={14} className="shrink-0" /> {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
            className="min-h-[44px] px-4 text-sm font-medium text-white bg-[#0FA3B1] hover:bg-[#0d8f9c] rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving…' : 'Confirm Change'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ org }: { org: OrgDetail }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="space-y-4">
        {/* Org details */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-heading text-sm font-semibold text-gray-800 mb-4">Organisation Details</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">Slug</dt>
              <dd className="text-sm font-mono text-gray-700 mt-0.5">{org.slug}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">Contact Email</dt>
              <dd className="text-sm text-gray-700 mt-0.5">{org.contact_email ?? '—'}</dd>
            </div>
            {org.contact_phone && (
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Contact Phone</dt>
                <dd className="text-sm text-gray-700 mt-0.5">{org.contact_phone}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">Created</dt>
              <dd className="text-sm text-gray-700 mt-0.5">
                {formatDistanceToNow(new Date(org.created_at), { addSuffix: true })}
              </dd>
            </div>
          </dl>
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-heading text-sm font-semibold text-gray-800 mb-4">Subscription</h3>
          {org.subscription ? (
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Plan</dt>
                <dd className="mt-0.5"><PlanBadge plan={org.subscription.plan_code} /></dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Status</dt>
                <dd className="mt-0.5"><StatusBadge status={org.subscription.status} /></dd>
              </div>
              {org.subscription.current_period_end && (
                <div>
                  <dt className="text-xs text-gray-400 uppercase tracking-wide">Period ends</dt>
                  <dd className="text-sm text-gray-700 mt-0.5">
                    {new Date(org.subscription.current_period_end).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-gray-400">No active subscription.</p>
          )}
        </div>
      </div>

      {/* Stat mini-cards */}
      <div className="space-y-3">
        {[
          { label: 'Workshops', value: org.usage.workshop_count },
          { label: 'Participants', value: org.usage.participant_count },
          { label: 'Managers', value: org.usage.manager_count },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p
              className="text-xs uppercase tracking-widest text-gray-400 mb-1"
              style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
            >
              {label}
            </p>
            <p className="font-heading text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Billing tab ─────────────────────────────────────────────────────────────

interface BillingTabProps {
  org: OrgDetail;
  onPlanChange: () => void;
}

function BillingTab({ org, onPlanChange }: BillingTabProps) {
  const { adminUser } = useAdminUser();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Staleness notice — always visible */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700">
          Billing data is mirrored from Stripe and may not reflect real-time changes
          until the Stripe webhook handler is configured.
        </p>
      </div>

      {/* Current subscription */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-sm font-semibold text-gray-800">Current Subscription</h3>
          {adminUser && can.manageBilling(adminUser.role) && (
            <button
              onClick={() => setShowModal(true)}
              className="min-h-[44px] px-4 text-sm font-medium text-white bg-[#0FA3B1] hover:bg-[#0d8f9c] rounded-lg transition-colors"
            >
              Change Plan
            </button>
          )}
        </div>
        {org.subscription ? (
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">Plan</dt>
              <dd className="mt-1"><PlanBadge plan={org.subscription.plan_code} /></dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">Status</dt>
              <dd className="mt-1"><StatusBadge status={org.subscription.status} /></dd>
            </div>
            {org.subscription.current_period_start && (
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Period Start</dt>
                <dd className="text-sm text-gray-700 mt-1">
                  {new Date(org.subscription.current_period_start).toLocaleDateString()}
                </dd>
              </div>
            )}
            {org.subscription.current_period_end && (
              <div>
                <dt className="text-xs text-gray-400 uppercase tracking-wide">Period End</dt>
                <dd className="text-sm text-gray-700 mt-1">
                  {new Date(org.subscription.current_period_end).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-gray-400">No active subscription.</p>
        )}
      </div>

      {showModal && (
        <PlanChangeModal
          orgId={org.id}
          currentPlan={org.subscription?.plan_code ?? null}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); onPlanChange(); }}
        />
      )}
    </div>
  );
}

// ─── Feature flags tab ────────────────────────────────────────────────────────

function FeatureFlagsTab({ orgId }: { orgId: number }) {
  const { adminUser } = useAdminUser();
  const { toast } = useToast();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformOrganizations.getFeatureFlags(orgId);
      setFlags(data);
    } catch {
      setError('Failed to load feature flags.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggle(flag: FeatureFlag) {
    if (!adminUser || !can.manageFeatureFlags(adminUser.role)) return;

    const newValue = !flag.is_enabled;
    // Optimistic update
    setFlags((prev) => prev.map((f) =>
      f.feature_key === flag.feature_key ? { ...f, is_enabled: newValue, source: 'manual_override' } : f
    ));

    try {
      await platformOrganizations.setFeatureFlag(orgId, flag.feature_key, newValue);
      toast(`${flag.feature_key} ${newValue ? 'enabled' : 'disabled'}.`, 'success');
    } catch {
      // Rollback
      setFlags((prev) => prev.map((f) =>
        f.feature_key === flag.feature_key ? { ...f, is_enabled: flag.is_enabled, source: flag.source } : f
      ));
      toast('Failed to update feature flag.', 'error');
    }
  }

  if (loading) return <div className="animate-pulse bg-gray-100 rounded-xl h-48" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  const canEdit = adminUser ? can.manageFeatureFlags(adminUser.role) : false;

  return (
    <Table>
      <TableHead>
        <Th>Feature</Th>
        <Th>Description</Th>
        <Th>Source</Th>
        <Th>Enabled</Th>
        {canEdit && <Th>Override</Th>}
      </TableHead>
      <TableBody>
        {flags.map((flag) => (
          <tr key={flag.feature_key} className="hover:bg-gray-50">
            <Td>
              <span
                className="text-sm font-medium text-gray-800"
                style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
              >
                {flag.feature_key}
              </span>
            </Td>
            <Td>
              <span className="text-sm text-gray-500">{flag.description ?? '—'}</span>
            </Td>
            <Td>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  flag.source === 'manual_override'
                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
              >
                {flag.source === 'manual_override' ? 'manual override' : 'plan default'}
              </span>
            </Td>
            <Td>
              <span className={`text-sm font-medium ${flag.is_enabled ? 'text-teal-600' : 'text-gray-400'}`}>
                {flag.is_enabled ? 'Yes' : 'No'}
              </span>
            </Td>
            {canEdit && (
              <Td>
                <button
                  onClick={() => handleToggle(flag)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:ring-offset-2 ${
                    flag.is_enabled ? 'bg-[#0FA3B1]' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={flag.is_enabled}
                  data-testid={`toggle-${flag.feature_key}`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      flag.is_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </Td>
            )}
          </tr>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Usage tab ────────────────────────────────────────────────────────────────

function UsageTab({ org }: { org: OrgDetail }) {
  const rows = [
    { label: 'Workshops', value: org.usage.workshop_count, limit: org.usage.workshop_limit },
    { label: 'Participants', value: org.usage.participant_count, limit: org.usage.participant_limit },
    { label: 'Managers', value: org.usage.manager_count, limit: org.usage.manager_limit },
  ];

  return (
    <div className="space-y-6 max-w-xl">
      {rows.map(({ label, value, limit }) => (
        <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">{label}</p>
          <UsageBar value={value} limit={limit} />
        </div>
      ))}
    </div>
  );
}

// ─── Audit tab ────────────────────────────────────────────────────────────────

function AuditTab({ orgId }: { orgId: number }) {
  const [logs, setLogs] = useState<PlatformAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformAuditLogs.list({ organization_id: orgId });
      setLogs(data.data);
    } catch {
      setError('Failed to load audit log.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="animate-pulse bg-gray-100 rounded-xl h-48" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">Platform admin actions only — not tenant audit events.</p>
      <Table>
        <TableHead>
          <Th>Date / Time</Th>
          <Th>Admin</Th>
          <Th>Action</Th>
          <Th>Entity</Th>
          <Th className="w-8" />
        </TableHead>
        <TableBody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                No platform admin actions recorded for this organisation.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <React.Fragment key={log.id}>
                <tr
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                >
                  <Td>
                    <span className="text-xs text-gray-500 font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm text-gray-700">{log.admin_name ?? '—'}</span>
                  </Td>
                  <Td>
                    <span
                      className="text-sm text-gray-800"
                      style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
                    >
                      {log.action}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm text-gray-500">
                      {log.entity_type ? `${log.entity_type}${log.entity_id ? ` #${log.entity_id}` : ''}` : '—'}
                    </span>
                  </Td>
                  <Td>
                    {expanded === log.id ? (
                      <ChevronDown size={14} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={14} className="text-gray-400" />
                    )}
                  </Td>
                </tr>
                {expanded === log.id && log.metadata_json && (
                  <tr className="bg-gray-50">
                    <td colSpan={5} className="px-6 py-3">
                      <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap overflow-auto max-h-48">
                        {JSON.stringify(log.metadata_json, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Payments tab ─────────────────────────────────────────────────────────────

const CONNECT_ONBOARDING_STYLES: Record<string, string> = {
  complete:     'bg-teal-50 text-teal-700 border border-teal-200',
  pending:      'bg-amber-50 text-amber-700 border border-amber-200',
  initiated:    'bg-blue-50 text-blue-700 border border-blue-200',
  restricted:   'bg-orange-50 text-orange-700 border border-orange-200',
  deauthorized: 'bg-red-50 text-red-700 border border-red-200',
};

function ConnectOnboardingBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-sm text-gray-400">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        CONNECT_ONBOARDING_STYLES[status] ?? 'bg-gray-100 text-gray-600 border border-gray-200'
      }`}
    >
      {status}
    </span>
  );
}

function ConnectBoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      {value ? (
        <CheckCircle size={16} className="text-teal-500" aria-label="Yes" />
      ) : (
        <XCircle size={16} className="text-gray-300" aria-label="No" />
      )}
    </div>
  );
}

function ToggleRow({
  label,
  enabled,
  onChange,
  disabled,
}: {
  label: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        onClick={() => onChange(!enabled)}
        disabled={disabled}
        role="switch"
        aria-checked={enabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          enabled ? 'bg-[#0FA3B1]' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function PaymentsTab({ orgId }: { orgId: number }) {
  const { adminUser } = useAdminUser();
  const { toast } = useToast();
  const [payStatus, setPayStatus] = useState<OrgPaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [flagUpdating, setFlagUpdating] = useState<string | null>(null);

  const canManage = adminUser ? can.managePayments(adminUser.role) : false;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformPayments.orgStatus(orgId);
      setPayStatus(data);
    } catch {
      setError('Failed to load payment status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggleOrg() {
    if (!payStatus) return;
    setToggling(true);
    try {
      const { data } = payStatus.org_payments_enabled
        ? await platformPayments.disableOrg(orgId)
        : await platformPayments.enableOrg(orgId);
      setPayStatus(data);
      toast(
        data.org_payments_enabled
          ? 'Payments enabled for this organisation.'
          : 'Payments disabled for this organisation.',
        'success',
      );
    } catch {
      toast('Failed to update payment setting.', 'error');
    } finally {
      setToggling(false);
    }
  }

  async function handleFlagToggle(flagKey: 'deposits_enabled' | 'waitlist_payments') {
    if (!payStatus) return;
    const currentValue = payStatus.flags[flagKey];
    // Optimistic update
    setPayStatus((prev) =>
      prev ? { ...prev, flags: { ...prev.flags, [flagKey]: !currentValue } } : prev,
    );
    setFlagUpdating(flagKey);
    try {
      await platformPayments.setOrgFlag(orgId, flagKey, !currentValue);
      toast(`${flagKey === 'deposits_enabled' ? 'Deposit pricing' : 'Waitlist payments'} ${!currentValue ? 'enabled' : 'disabled'}.`, 'success');
    } catch {
      // Rollback
      setPayStatus((prev) =>
        prev ? { ...prev, flags: { ...prev.flags, [flagKey]: currentValue } } : prev,
      );
      toast('Failed to update flag.', 'error');
    } finally {
      setFlagUpdating(null);
    }
  }

  if (loading) return <div className="animate-pulse bg-gray-100 rounded-xl h-64 max-w-2xl" />;
  if (error || !payStatus) return <ErrorBanner message={error ?? 'Failed to load.'} onRetry={load} />;

  const { stripe_connect, effective_payments_active, org_payments_enabled } = payStatus;

  // Determine which status banner to show
  let statusBanner: React.ReactNode;
  if (effective_payments_active) {
    statusBanner = (
      <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-3 flex items-center gap-2 text-sm text-teal-700">
        <CheckCircle size={16} className="text-teal-500 shrink-0" aria-hidden="true" />
        Payments are ACTIVE for this organisation
      </div>
    );
  } else if (!org_payments_enabled) {
    statusBanner = (
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
        Payments are disabled for this organisation.
      </div>
    );
  } else if (!stripe_connect.charges_enabled) {
    statusBanner = (
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2 text-sm text-red-700">
        <AlertTriangle size={16} className="text-red-500 shrink-0" aria-hidden="true" />
        Stripe Connect incomplete — payments cannot process.
      </div>
    );
  } else {
    statusBanner = (
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
        <AlertTriangle size={16} className="text-amber-500 shrink-0" aria-hidden="true" />
        Platform payments are globally disabled.
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Effective status banner */}
      {statusBanner}

      {/* Payment toggle card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-sm font-semibold text-gray-800">Organisation Payments</h3>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              org_payments_enabled
                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}
          >
            {org_payments_enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        {canManage && (
          <button
            onClick={handleToggleOrg}
            disabled={toggling}
            data-testid="org-payment-toggle"
            className={`min-h-[44px] px-4 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${
              org_payments_enabled
                ? 'bg-gray-600 hover:bg-gray-700'
                : 'bg-[#0FA3B1] hover:bg-[#0d8f9c]'
            }`}
          >
            {toggling
              ? 'Updating…'
              : org_payments_enabled
              ? 'Disable Payments'
              : 'Enable Payments'}
          </button>
        )}
      </div>

      {/* Stripe Connect status card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-heading text-sm font-semibold text-gray-800 mb-4">Stripe Connect</h3>
        <div className="mb-4">
          <ConnectOnboardingBadge status={stripe_connect.onboarding_status} />
        </div>
        <div className="space-y-0 mb-4">
          <ConnectBoolRow label="Charges enabled" value={stripe_connect.charges_enabled} />
          <ConnectBoolRow label="Payouts enabled" value={stripe_connect.payouts_enabled} />
          <ConnectBoolRow label="Details submitted" value={stripe_connect.details_submitted} />
        </div>
        {stripe_connect.stripe_account_id && (
          <p
            className="text-xs text-gray-400 mb-2"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            {stripe_connect.stripe_account_id}
          </p>
        )}
        {stripe_connect.last_webhook_received_at && (
          <p className="text-xs text-gray-400 mb-2">
            Last webhook:{' '}
            {formatDistanceToNow(new Date(stripe_connect.last_webhook_received_at), {
              addSuffix: true,
            })}
          </p>
        )}
        {(stripe_connect.requirements ?? []).length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            <p className="text-xs font-medium text-amber-700 mb-1">Pending requirements:</p>
            <ul className="text-xs text-amber-600 space-y-0.5">
              {(stripe_connect.requirements ?? []).map((req) => (
                <li key={req}>{req}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-gray-400 mb-2">
          Stripe Connect accounts are managed in the Stripe Dashboard.
        </p>
        {stripe_connect.stripe_account_id && (
          <a
            href={`https://dashboard.stripe.com/connect/accounts/${stripe_connect.stripe_account_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[#0FA3B1] hover:text-[#0d8f9c] transition-colors"
          >
            Open Stripe Dashboard <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Additional flags card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-heading text-sm font-semibold text-gray-800 mb-2">Payment Flags</h3>
        <ToggleRow
          label="Deposit pricing enabled"
          enabled={payStatus.flags.deposits_enabled}
          onChange={() => handleFlagToggle('deposits_enabled')}
          disabled={!canManage || flagUpdating === 'deposits_enabled'}
        />
        <ToggleRow
          label="Waitlist payment charging"
          enabled={payStatus.flags.waitlist_payments}
          onChange={() => handleFlagToggle('waitlist_payments')}
          disabled={!canManage || flagUpdating === 'waitlist_payments'}
        />
      </div>
    </div>
  );
}

// ─── Workshops tab ────────────────────────────────────────────────────────────

function formatCentsLocal(cents: number | null): string {
  if (cents === null) return 'Free';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function MonoText({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}>{children}</span>
  );
}


const SESSION_TYPE_BADGE: Record<AddonSessionPricing['session_type'], string> = {
  addon:       'bg-teal-50 text-teal-700 border border-teal-100',
  invite_only: 'bg-purple-50 text-purple-700 border border-purple-100',
};

function AddonPricingSection({ orgId }: { orgId: number }) {
  const [addons, setAddons] = useState<AddonSessionPricing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformWorkshops.addonPricing({ organization_id: orgId });
      setAddons(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load add-on pricing.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (expanded) load();
  }, [expanded, orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="rounded-xl border border-gray-200 overflow-hidden"
      data-testid="addon-pricing-section"
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors min-h-[44px] text-left"
        aria-expanded={expanded}
        data-testid="addon-pricing-toggle"
      >
        <span className="flex items-center gap-2 font-heading text-sm font-semibold text-gray-800">
          <Layers size={15} className="text-gray-400" />
          Add-On Session Pricing
        </span>
        {expanded ? (
          <ChevronDown size={16} className="text-gray-400 shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-gray-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="bg-white">
          {loading ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 h-10 rounded" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4">
              <ErrorBanner message={error} onRetry={load} />
            </div>
          ) : addons.length === 0 ? (
            <p
              className="px-5 py-6 text-sm text-gray-400 text-center"
              data-testid="addon-pricing-empty"
            >
              No add-on session pricing configured for this organisation.
            </p>
          ) : (
            <Table>
              <TableHead>
                <Th>Session</Th>
                <Th>Workshop</Th>
                <Th>Type</Th>
                <Th>Price</Th>
                <Th>Non-Refundable</Th>
              </TableHead>
              <TableBody>
                {addons.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <Td>
                      <span className="text-sm font-medium text-gray-900">{item.session_title}</span>
                    </Td>
                    <Td>
                      <span className="text-sm text-gray-600">{item.workshop_title}</span>
                    </Td>
                    <Td>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SESSION_TYPE_BADGE[item.session_type] ?? 'bg-gray-100 text-gray-600 border border-gray-200'}`}
                      >
                        {item.session_type === 'invite_only' ? 'Invite Only' : 'Add-On'}
                      </span>
                    </Td>
                    <Td>
                      <MonoText>
                        <span className="text-sm text-gray-800">{formatCentsLocal(item.price_cents)}</span>
                      </MonoText>
                    </Td>
                    <Td>
                      {item.is_nonrefundable ? (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-50 text-red-700 border border-red-100">Yes</span>
                      ) : (
                        <span className="text-sm text-gray-400">No</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

function WorkshopsTab({ orgId }: { orgId: number }) {
  const [items, setItems] = useState<WorkshopPricingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformWorkshops.pricingAudit({ organization_id: orgId });
      setItems(data.data);
      setTotal(data.total);
    } catch {
      setError('Failed to load workshop pricing.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-12" />
        ))}
      </div>
    );
  }

  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      {/* Workshop pricing table */}
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-heading text-sm font-semibold text-gray-800">Workshop Pricing</h3>
          <span
            className="text-xs text-gray-400"
            style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
          >
            {total} workshop{total !== 1 ? 's' : ''}
          </span>
        </div>
        {items.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No workshops found.</p>
        ) : (
          <Table>
            <TableHead>
              <Th>Workshop</Th>
              <Th>Status</Th>
              <Th>Priced Sessions</Th>
              <Th>Base Price</Th>
              <Th>Deposit</Th>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <tr key={item.workshop_id} className="hover:bg-gray-50">
                  <Td>
                    <span className="text-sm font-medium text-gray-900">{item.title}</span>
                  </Td>
                  <Td>
                    <span className="text-sm text-gray-500 capitalize">{item.status}</span>
                  </Td>
                  <Td>
                    <MonoText>
                      <span className="text-sm text-gray-600">{item.pricing.session_pricing_count}</span>
                    </MonoText>
                  </Td>
                  <Td>
                    <MonoText>
                      <span className="text-sm font-medium text-gray-800">
                        {item.pricing.has_pricing ? formatCentsLocal(item.pricing.base_price_cents) : '—'}
                      </span>
                    </MonoText>
                  </Td>
                  <Td>
                    <MonoText>
                      <span className="text-sm text-gray-600">
                        {item.pricing.deposit_enabled
                          ? formatCentsLocal(item.pricing.deposit_amount_cents)
                          : '—'}
                      </span>
                    </MonoText>
                  </Td>
                </tr>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add-On Session Pricing — collapsible sub-section */}
      <AddonPricingSection orgId={orgId} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const orgId = Number(id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { adminUser } = useAdminUser();

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeTab = (searchParams.get('tab') ?? 'overview') as Tab;

  function setTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/organizations/${orgId}?${params.toString()}`);
  }

  async function loadOrg() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformOrganizations.get(orgId);
      setOrg(data);
    } catch {
      setError('Failed to load organisation.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOrg(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="max-w-5xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-10 bg-gray-100 rounded" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !org) {
    return <ErrorBanner message={error ?? 'Organisation not found.'} onRetry={loadOrg} />;
  }

  const role = adminUser?.role;
  const showFlagsTab = role && !['billing', 'support'].includes(role);
  const showAuditTab = role && !['billing', 'readonly'].includes(role);

  const visibleTabs: Array<{ key: Tab; label: string }> = [
    { key: 'overview',  label: 'Overview' },
    { key: 'billing',   label: 'Billing' },
    ...(showFlagsTab ? [{ key: 'flags' as Tab, label: 'Feature Flags' }] : []),
    { key: 'usage',     label: 'Usage' },
    { key: 'payments',  label: 'Payments' },
    { key: 'workshops', label: 'Workshops' },
    ...(showAuditTab ? [{ key: 'audit' as Tab, label: 'Audit' }] : []),
  ];

  return (
    <div className="max-w-5xl">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-heading text-2xl font-bold text-gray-900">{org.name}</h1>
          <StatusBadge status={org.status} />
          <PlanBadge plan={org.subscription?.plan_code ?? 'foundation'} />
        </div>
        <Link
          href="/organizations"
          className="min-h-[44px] flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors ml-4 shrink-0"
        >
          ← Organisations
        </Link>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px">
          {visibleTabs.map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`min-h-[44px] px-5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-[#0FA3B1] text-[#0FA3B1]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab org={org} />}
      {activeTab === 'billing' && (
        <BillingTab org={org} onPlanChange={loadOrg} />
      )}
      {activeTab === 'flags' && showFlagsTab && <FeatureFlagsTab orgId={orgId} />}
      {activeTab === 'usage' && <UsageTab org={org} />}
      {activeTab === 'payments' && <PaymentsTab orgId={orgId} />}
      {activeTab === 'workshops' && <WorkshopsTab orgId={orgId} />}
      {activeTab === 'audit' && showAuditTab && <AuditTab orgId={orgId} />}
    </div>
  );
}

'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle,
  CreditCard,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet, apiPost, ApiError } from '@/lib/api/client';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StripeStatusData {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_status: string | null;
  details_submitted: boolean;
  requirements: {
    currently_due?: string[];
    past_due?: string[];
    eventually_due?: string[];
    pending_verification?: string[];
  };
  payments_enabled_for_org: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REQUIREMENT_LABELS: Record<string, string> = {
  'individual.id_number': 'Government ID verification required',
  'individual.verification.document': 'Identity document required',
  'individual.dob.day': 'Date of birth required',
  'individual.address.line1': 'Personal address required',
  'individual.address.city': 'City required',
  'individual.address.postal_code': 'Postal code required',
  'individual.phone': 'Phone number required',
  'individual.email': 'Email address required',
  'individual.first_name': 'First name required',
  'individual.last_name': 'Last name required',
  'business_profile.url': 'Business website URL required',
  'business_profile.mcc': 'Business category required',
  'external_account': 'Bank account or debit card required',
  'tos_acceptance.date': 'Terms of service acceptance required',
  'tos_acceptance.ip': 'Terms of service acceptance required',
};

function humanizeRequirement(key: string): string {
  return REQUIREMENT_LABELS[key] ?? key.replace(/\./g, ' › ').replace(/_/g, ' ');
}

const TAKE_RATE_BY_PLAN: Record<string, number> = {
  free: 2.0,
  starter: 2.0,
  pro: 1.5,
  enterprise: 1.0,
};

function calcExamplePayout(takeRate: number, amount = 200): string {
  const platform = amount * (takeRate / 100);
  const stripe = amount * 0.029 + 0.3;
  return (amount - platform - stripe).toFixed(2);
}

// ─── Disconnect confirmation modal ────────────────────────────────────────────

function DisconnectModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-dark/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[440px] bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] p-8">
        <h2 className="font-heading text-lg font-semibold text-dark mb-3">
          Disconnect Stripe account?
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Your existing orders and payment history will be preserved. Future
          payments for your workshops will be disabled until you reconnect.
        </p>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          Disconnecting is done from your Stripe dashboard — click{' '}
          <strong>Go to Stripe</strong> to remove Wayfield&apos;s access there.
          Your account status here will update automatically.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-lg border border-primary text-primary
              text-sm font-semibold hover:bg-primary/5 transition-colors"
          >
            Keep Connected
          </button>
          <a
            href="https://dashboard.stripe.com/settings/applications"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex-1 h-10 rounded-lg bg-danger text-white text-sm font-semibold
              hover:bg-[#c93f29] transition-colors flex items-center justify-center gap-1.5"
          >
            <ExternalLink size={14} />
            Go to Stripe
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Stripe return query-param handler ────────────────────────────────────────
// Isolated in its own component so useSearchParams is inside a Suspense boundary.

function StripeReturnHandler({ onRefresh }: { onRefresh: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (searchParams.get('stripe_return') !== '1') return;
    handled.current = true;
    router.replace('/organization/settings/payments');
    // Give the Stripe webhook a moment before re-polling status
    const t = setTimeout(onRefresh, 1500);
    return () => clearTimeout(t);
  }, [searchParams, router, onRefresh]);

  return null;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="max-w-lg">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 animate-pulse">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-gray-100 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-100 rounded w-2/3" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
        <div className="h-10 bg-gray-100 rounded-xl mt-6" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrganizationPaymentsPage() {
  useSetPage('Payments', [
    { label: 'Organization' },
    { label: 'Settings', href: '/organization/settings' },
    { label: 'Payments' },
  ]);

  const { currentOrg } = useUser();

  const [status, setStatus] = useState<StripeStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  const planCode = currentOrg?.plan_code ?? 'free';
  const takeRate = TAKE_RATE_BY_PLAN[planCode] ?? 2.0;
  const examplePayout = calcExamplePayout(takeRate);
  const canManage = ['owner', 'admin'].includes(currentOrg?.role ?? '');

  const loadStatus = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const res = await apiGet<{ data: StripeStatusData }>(
        `/organizations/${currentOrg.id}/stripe/status`,
      );
      setStatus(res.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      } else {
        toast.error('Failed to load payment settings. Please refresh the page.');
      }
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const paymentsNotEnabled = !loading && status && !status.payments_enabled_for_org;

  // ── Action handlers ────────────────────────────────────────────────────────

  async function handleConnect() {
    if (!currentOrg) return;
    setIsConnecting(true);
    try {
      const res = await apiPost<{ data: { account_link_url: string } }>(
        `/organizations/${currentOrg.id}/stripe/connect`,
      );
      window.location.href = res.data.account_link_url;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          // Account already exists — re-fetch status to render the correct state
          toast('A Stripe account was found. Refreshing status.', { icon: 'ℹ️' });
          await loadStatus();
        } else {
          toast.error(err.message || 'Could not start Stripe setup. Please try again.');
        }
      } else {
        toast.error('Could not start Stripe setup. Please try again.');
      }
      setIsConnecting(false);
    }
  }

  async function handleCompleteSetup() {
    if (!currentOrg) return;
    setIsRefreshing(true);
    try {
      const res = await apiPost<{ data: { account_link_url: string } }>(
        `/organizations/${currentOrg.id}/stripe/refresh-link`,
      );
      window.location.href = res.data.account_link_url;
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message || 'Could not generate a setup link. Please try again.'
          : 'Could not generate a setup link. Please try again.',
      );
      setIsRefreshing(false);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const isNotConnected =
    !status?.connected || status.onboarding_status === 'deauthorized';
  const isIncomplete = status?.connected && !status.charges_enabled;
  const isActive = status?.connected && status.charges_enabled;

  const pendingRequirements = [
    ...(status?.requirements?.currently_due ?? []),
    ...(status?.requirements?.past_due ?? []),
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[1280px] mx-auto">
      {/* Handles ?stripe_return=1 from the backend's current return URL */}
      <Suspense fallback={null}>
        <StripeReturnHandler onRefresh={loadStatus} />
      </Suspense>

      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-dark">Payments</h1>
        <p className="text-sm text-medium-gray mt-1">
          Connect your Stripe account to accept payments for your workshops.
        </p>
      </div>

      {/* ── Loading ── */}
      {loading && <LoadingSkeleton />}

      {/* ── Payments not enabled for this org ── */}
      {paymentsNotEnabled && (
        <div className="max-w-lg rounded-2xl border border-border-gray bg-white p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <CreditCard className="text-gray-400" size={24} />
          </div>
          <p className="font-semibold text-gray-900 mb-1">Payments not available</p>
          <p className="text-sm text-medium-gray">
            Payments haven&apos;t been enabled for your organization yet. Contact Wayfield support to get started.
          </p>
        </div>
      )}

      {/* ── No permission ── */}
      {!loading && forbidden && (
        <div className="max-w-lg rounded-2xl border border-border-gray bg-white p-8 text-center">
          <p className="text-sm text-medium-gray">
            You don&apos;t have permission to view payment settings.
          </p>
        </div>
      )}

      {/* ── STATE 1: Not Connected ─────────────────────────────────────────── */}
      {!loading && !forbidden && !paymentsNotEnabled && isNotConnected && (
        <div className="max-w-lg">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <CreditCard className="text-gray-400" size={24} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">No payment account connected</p>
                <p className="text-sm text-gray-500">
                  Connect Stripe to accept registrations
                </p>
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 shrink-0">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                Not Connected
              </span>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 font-mono">
                What you get
              </p>
              <ul className="space-y-2">
                {[
                  'Accept payments directly from participants',
                  'Receive payouts to your bank account',
                  ...(FEATURE_FLAGS.PAYMENTS_ENABLED ? [`${takeRate}% platform fee + Stripe 2.9% + $0.30/transaction`] : ['Stripe payment processing included']),
                  'Full refund management through Wayfield',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle size={16} className="text-primary mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {canManage ? (
            <>
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-3 bg-primary
                  hover:bg-[#0c8a96] text-white font-semibold rounded-xl py-3.5
                  transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Connecting…
                  </>
                ) : (
                  <>
                    <ExternalLink size={18} />
                    Connect with Stripe
                  </>
                )}
              </button>
              <p className="text-center text-xs text-gray-400 mt-3">
                You&apos;ll be redirected to Stripe to complete setup. This takes about 5 minutes.
              </p>
            </>
          ) : (
            <p className="text-center text-sm text-medium-gray">
              Only organization owners and admins can connect a payment account.
            </p>
          )}
        </div>
      )}

      {/* ── STATE 2: Onboarding Incomplete ────────────────────────────────── */}
      {!loading && !forbidden && !paymentsNotEnabled && isIncomplete && (
        <div className="max-w-lg">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-amber-600 shrink-0" size={22} />
              <div className="min-w-0">
                <p className="font-semibold text-amber-900">Setup incomplete</p>
                <p className="text-sm text-amber-700">
                  Your Stripe account needs more information before you can accept payments.
                </p>
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 shrink-0">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Setup Incomplete
              </span>
            </div>

            {pendingRequirements.length > 0 && (
              <div className="border-t border-amber-200 pt-4">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-3 font-mono">
                  Action required
                </p>
                <ul className="space-y-1.5">
                  {pendingRequirements.map((req) => (
                    <li key={req} className="flex items-start gap-2 text-sm text-amber-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      {humanizeRequirement(req)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {canManage && (
            <>
              <button
                onClick={handleCompleteSetup}
                disabled={isRefreshing}
                className="w-full flex items-center justify-center gap-3 bg-amber-500
                  hover:bg-amber-600 text-white font-semibold rounded-xl py-3.5
                  transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating link…
                  </>
                ) : (
                  <>
                    <ExternalLink size={18} />
                    Complete Setup
                  </>
                )}
              </button>
              <p className="text-center text-xs text-gray-400 mt-3">
                You&apos;ll be redirected to Stripe to complete the remaining steps.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── STATE 3: Connected & Active ───────────────────────────────────── */}
      {!loading && !forbidden && !paymentsNotEnabled && isActive && (
        <div className="max-w-lg space-y-4">
          {/* Status card */}
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-600 shrink-0" size={22} />
              <div>
                <p className="font-semibold text-green-900">Stripe account connected</p>
                <p className="text-sm text-green-700">Ready to accept payments</p>
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 shrink-0">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Active
              </span>
            </div>
          </div>

          {/* Fee breakdown */}
          {FEATURE_FLAGS.PAYMENTS_ENABLED && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-sm font-semibold text-gray-900 mb-4">Your fee structure</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Wayfield platform fee</span>
                  <span className="font-medium">{takeRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Stripe processing fee</span>
                  <span className="font-medium">2.9% + $0.30</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2 mt-2">
                  <span className="text-gray-700 font-medium">Example: $200 workshop</span>
                  <span className="font-semibold text-primary">
                    You receive ~${examplePayout}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                * Estimates only. Actual amounts depend on refunds and chargebacks.
              </p>
            </div>
          )}

          {/* Payouts status */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Payouts to bank</span>
              <span
                className={`text-sm font-semibold ${
                  status!.payouts_enabled ? 'text-green-600' : 'text-amber-600'
                }`}
              >
                {status!.payouts_enabled ? 'Enabled' : 'Pending verification'}
              </span>
            </div>
          </div>

          {/* Disconnect — tucked away, requires confirmation */}
          {canManage && (
            <p className="text-center">
              <button
                onClick={() => setShowDisconnect(true)}
                className="text-xs text-gray-400 hover:text-danger transition-colors
                  hover:underline underline-offset-2"
              >
                Disconnect Stripe account
              </button>
            </p>
          )}
        </div>
      )}

      {showDisconnect && (
        <DisconnectModal onClose={() => setShowDisconnect(false)} />
      )}
    </div>
  );
}

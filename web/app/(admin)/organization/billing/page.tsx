'use client'

import { useCallback, useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
// useRouter is used in CheckoutResultHandler; useSearchParams requires Suspense
import toast from 'react-hot-toast'
import { ExternalLink, FileText, TrendingUp } from 'lucide-react'
import { useSetPage } from '@/contexts/PageContext'
import { useUser } from '@/contexts/UserContext'
import { apiGet, apiPost, ApiError } from '@/lib/api/client'
import { cancelSubscription, resumeSubscription } from '@/lib/api/billing'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PricingPage } from '@/components/pricing/PricingPage'

interface PlanLimits {
  max_workshops: number | null
  max_participants_per_workshop: number | null
  max_managers: number | null
}

interface PlanUsage {
  active_workshops: number
  total_participants: number
  managers: number
}

interface Invoice {
  id: string
  amount_cents: number
  currency: string
  status: 'paid' | 'open' | 'void' | 'uncollectible'
  period_start: string
  period_end: string
  paid_at: string | null
  pdf_url: string | null
}

interface SubscriptionData {
  plan_code: 'foundation' | 'creator' | 'studio' | 'enterprise'
  plan_name: string
  billing_cycle: 'monthly' | 'annual' | null
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'
  current_period_start: string | null
  current_period_end: string | null
  renewal_date: string | null
  cancel_at_period_end: boolean
  limits: PlanLimits
  usage: PlanUsage
  invoices: Invoice[]
}

const BILLING_ROLES = ['owner', 'billing_admin']

const PLAN_DISPLAY: Record<string, string> = {
  foundation: 'Foundation',
  creator: 'Creator',
  studio: 'Studio',
  enterprise: 'Enterprise',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
  } catch {
    return '—'
  }
}

function formatCurrency(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
  } catch {
    return `$${(cents / 100).toFixed(2)}`
  }
}

interface UsageBarProps {
  label: string
  used: number
  max: number | null
}

function UsageBar({ label, used, max }: UsageBarProps) {
  const unlimited = max === null
  const pct = unlimited ? 0 : Math.min((used / max) * 100, 100)
  const barColor = pct >= 90 ? '#E94F37' : pct >= 80 ? '#E67E22' : '#0FA3B1'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#374151', fontWeight: 500 }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#6B7280' }}>
          {unlimited ? (
            <>{used} <span style={{ fontSize: '11px', color: '#9CA3AF' }}>unlimited</span></>
          ) : (
            `${used} / ${max}`
          )}
        </span>
      </div>
      {!unlimited && (
        <div style={{ height: '6px', background: '#F3F4F6', borderRadius: '9999px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: barColor,
              borderRadius: '9999px',
              transition: 'width 300ms ease',
            }}
          />
        </div>
      )}
    </div>
  )
}

interface CancelConfirmModalProps {
  planName: string
  periodEnd: string | null
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function CancelConfirmModal({ planName, periodEnd, onConfirm, onCancel, loading }: CancelConfirmModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#2E2E2E', marginBottom: '12px' }}>
          Cancel subscription?
        </div>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#4B5563', lineHeight: '1.6', margin: '0 0 24px' }}>
          Your <strong>{planName}</strong> plan will stay active until{' '}
          <strong>{periodEnd ?? 'the end of your billing period'}</strong>. After that your
          organization moves to the Foundation plan.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            style={{
              flex: 1,
              height: '40px',
              borderRadius: '8px',
              background: loading ? '#F87171' : '#E94F37',
              color: 'white',
              border: 'none',
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Canceling…' : 'Confirm Cancellation'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            style={{
              flex: 1,
              height: '40px',
              borderRadius: '8px',
              background: 'white',
              color: '#0FA3B1',
              border: '1px solid #0FA3B1',
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Keep My Plan
          </button>
        </div>
      </div>
    </div>
  )
}

function invoiceStatusVariant(status: Invoice['status']): 'status-active' | 'status-draft' | 'status-archived' {
  if (status === 'paid') return 'status-active'
  if (status === 'open') return 'status-draft'
  return 'status-archived'
}

// Isolated component so useSearchParams is inside a Suspense boundary
function CheckoutResultHandler() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const toastShown = useRef(false)

  useEffect(() => {
    if (toastShown.current) return
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    if (success === '1') {
      toastShown.current = true
      toast.success('Plan upgraded successfully!')
      router.replace('/organization/billing')
    } else if (canceled === '1') {
      toastShown.current = true
      toast('Checkout canceled. Your plan was not changed.', { icon: '↩' })
      router.replace('/organization/billing')
    }
  }, [searchParams, router])

  return null
}

export default function OrganizationBillingPage() {
  useSetPage('Billing', [
    { label: 'Organization' },
    { label: 'Billing' },
  ])

  const { currentOrg } = useUser()
  const role = currentOrg?.role ?? ''
  const canAccess = BILLING_ROLES.includes(role)

  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [resumeLoading, setResumeLoading] = useState(false)

  const pricingRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    if (!currentOrg || !canAccess) return
    try {
      const res = await apiGet<SubscriptionData>(`/organizations/${currentOrg.id}/subscription`)
      setData(res)
    } catch {
      toast.error('Failed to load billing information')
    } finally {
      setLoading(false)
    }
  }, [currentOrg, canAccess])

  useEffect(() => {
    if (!currentOrg) return
    if (!canAccess) { setLoading(false); return }
    loadData()
  }, [currentOrg, canAccess, loadData])

  async function handleManage() {
    if (!currentOrg) return
    setPortalLoading(true)
    try {
      const res = await apiPost<{ portal_url: string }>(`/organizations/${currentOrg.id}/billing/portal`)
      window.location.href = res.portal_url
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not open billing portal')
      setPortalLoading(false)
    }
  }

  function scrollToPricing() {
    pricingRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleCancelConfirm() {
    if (!currentOrg) return
    setCancelLoading(true)
    try {
      await cancelSubscription(currentOrg.id)
      toast.success('Subscription canceled. Your plan stays active until the end of the period.')
      setShowCancelModal(false)
      await loadData()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not cancel subscription')
    } finally {
      setCancelLoading(false)
    }
  }

  async function handleResume() {
    if (!currentOrg) return
    setResumeLoading(true)
    try {
      await resumeSubscription(currentOrg.id)
      toast.success('Subscription resumed!')
      await loadData()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not resume subscription')
    } finally {
      setResumeLoading(false)
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
    )
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
    )
  }

  const hasSubscription = data.plan_code !== 'foundation'
  const displayName = PLAN_DISPLAY[data.plan_code] ?? data.plan_name
  const statusBadgeVariant =
    data.status === 'active' || data.status === 'trialing'
      ? 'status-active'
      : data.status === 'past_due'
        ? 'status-draft'
        : 'status-archived'

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
      {/* Stripe redirect query param handler */}
      <Suspense fallback={null}>
        <CheckoutResultHandler />
      </Suspense>

      {/* -- Current Plan Card -- */}
      <Card>
        <div
          style={{
            padding: '24px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          {/* Left: plan info */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '10px',
                color: '#9CA3AF',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                marginBottom: '6px',
              }}
            >
              Your Current Plan
            </div>
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '22px',
                fontWeight: 700,
                color: '#2E2E2E',
                marginBottom: '8px',
              }}
            >
              {displayName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <Badge variant={statusBadgeVariant}>
                {data.status.replace('_', ' ')}
              </Badge>
            </div>
            {data.billing_cycle && data.current_period_end && (
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#6B7280' }}>
                Billed {data.billing_cycle} · Renews {formatDate(data.current_period_end)}
              </p>
            )}
          </div>

          {/* Right: action button */}
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {hasSubscription ? (
              <Button variant="secondary" onClick={handleManage} loading={portalLoading}>
                <ExternalLink className="w-4 h-4" />
                Manage billing
              </Button>
            ) : (
              <Button onClick={scrollToPricing}>
                <TrendingUp className="w-4 h-4" />
                Upgrade
              </Button>
            )}
          </div>
        </div>

        {/* Usage row */}
        <div
          style={{
            borderTop: '1px solid #F3F4F6',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              color: '#9CA3AF',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '4px',
            }}
          >
            Usage this period
          </div>
          <UsageBar label="Active Workshops" used={data.usage.active_workshops} max={data.limits.max_workshops} />
          <UsageBar label="Total Participants" used={data.usage.total_participants} max={data.limits.max_participants_per_workshop} />
          <UsageBar label="Organization Managers" used={data.usage.managers} max={data.limits.max_managers} />
        </div>
      </Card>

      {/* -- Invoice History -- */}
      {data.invoices && data.invoices.length > 0 && (
        <Card>
          <div className="px-6 py-5 border-b border-border-gray">
            <h2 className="font-heading text-base font-semibold text-dark">Invoice History</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-gray">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-light-gray">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-light-gray hidden sm:table-cell">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-light-gray hidden md:table-cell">Period</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-light-gray hidden lg:table-cell">Paid</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-widest text-light-gray">PDF</th>
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

      {/* -- Pricing Section -- */}
      <div ref={pricingRef} id="pricing">
        <PricingPage
          context="billing"
          currentPlanCode={data.plan_code}
          orgId={currentOrg?.id}
          orgName={currentOrg?.name}
          onSuccess={loadData}
        />
      </div>

      {/* -- Danger Zone: Cancel / Resume (owner only) -- */}
      {role === 'owner' && hasSubscription && (
        <Card>
          <div className="px-6 py-5 border-b border-border-gray">
            <h2 className="font-heading text-base font-semibold" style={{ color: '#E94F37' }}>
              Danger Zone
            </h2>
          </div>
          <div className="px-6 py-6">
            {data.cancel_at_period_end ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#374151', fontWeight: 500 }}>
                    Your plan is canceled and ends on{' '}
                    <strong>{formatDate(data.current_period_end)}</strong>.
                  </p>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                    After this date your organization moves to the Foundation plan.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleResume}
                  loading={resumeLoading}
                >
                  Resume Subscription
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#374151', fontWeight: 500 }}>
                    Cancel your {displayName} plan
                  </p>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                    Your plan will remain active until the end of the current billing period.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  style={{
                    height: '36px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    background: 'white',
                    color: '#E94F37',
                    border: '1px solid #E94F37',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel Subscription
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Cancel confirmation modal */}
      {showCancelModal && (
        <CancelConfirmModal
          planName={displayName}
          periodEnd={formatDate(data.current_period_end)}
          onConfirm={handleCancelConfirm}
          onCancel={() => setShowCancelModal(false)}
          loading={cancelLoading}
        />
      )}
    </div>
  )
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  Plus,
  Search,
  Tag,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { ApiError } from '@/lib/api/client';
import {
  activateCoupon,
  deactivateCoupon,
  getCouponRedemptions,
  listCoupons,
  type Coupon,
  type CouponFilters,
  type CouponRedemption,
} from '@/lib/api/coupons';
import { getWorkshops } from '@/lib/api/workshops';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CouponAnalyticsSummary } from '@/components/coupons/CouponAnalyticsSummary';
import { BulkGenerateModal } from '@/components/coupons/BulkGenerateModal';

interface Workshop {
  id: number;
  title: string;
}

const COUPON_ROLES = ['owner', 'admin'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function couponStatus(c: Coupon): 'active' | 'inactive' | 'scheduled' | 'expired' {
  if (!c.is_active) return 'inactive';
  const now = Date.now();
  if (c.valid_from && new Date(c.valid_from).getTime() > now) return 'scheduled';
  if (c.valid_until && new Date(c.valid_until).getTime() < now) return 'expired';
  return 'active';
}

function statusBadge(s: ReturnType<typeof couponStatus>) {
  switch (s) {
    case 'active':
      return <Badge variant="status-active">Active</Badge>;
    case 'scheduled':
      return <Badge variant="status-draft">Scheduled</Badge>;
    case 'expired':
      return <Badge variant="status-archived">Expired</Badge>;
    case 'inactive':
      return <Badge variant="status-archived">Inactive</Badge>;
  }
}

function typeBadge(type: Coupon['discount_type']) {
  const labels: Record<Coupon['discount_type'], string> = {
    percentage: '% Off',
    fixed_amount: '$ Off',
    free: 'Free',
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: '#F0FDFF',
        color: '#0FA3B1',
        letterSpacing: '0.02em',
      }}
    >
      {labels[type]}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
  } catch {
    return '—';
  }
}

// ─── Redemptions slide-over ───────────────────────────────────────────────────

function RedemptionsPanel({
  coupon,
  organizationId,
  onClose,
}: {
  coupon: Coupon;
  organizationId: number;
  onClose: () => void;
}) {
  const [redemptions, setRedemptions] = useState<CouponRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await getCouponRedemptions(organizationId, coupon.id, p);
        setRedemptions(res.data);
        setLastPage(res.meta.last_page);
        setTotal(res.meta.total);
      } catch {
        toast.error('Failed to load redemptions');
      } finally {
        setLoading(false);
      }
    },
    [organizationId, coupon.id],
  );

  useEffect(() => {
    load(page);
  }, [load, page]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          zIndex: 49,
        }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Coupon redemptions"
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 'min(600px, 100vw)',
          backgroundColor: '#ffffff',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
          animation: 'slideInRight 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid #E5E7EB',
            flexShrink: 0,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                fontSize: 18,
                color: '#111827',
                letterSpacing: '0.06em',
                margin: 0,
              }}
            >
              {coupon.code}
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 0' }}>
              {total} redemption{total !== 1 ? 's' : ''} · {coupon.discount_formatted}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#6B7280',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Summary row */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid #F3F4F6',
            display: 'flex',
            gap: 32,
            flexShrink: 0,
            backgroundColor: '#FAFAFA',
          }}
        >
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              Total Uses
            </p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '2px 0 0', fontFamily: 'Sora, sans-serif' }}>
              {coupon.redemption_count}
              {coupon.max_redemptions != null && (
                <span style={{ fontSize: 13, fontWeight: 400, color: '#9CA3AF' }}>
                  {' '}/ {coupon.max_redemptions}
                </span>
              )}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              Total Saved
            </p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '2px 0 0', fontFamily: 'Sora, sans-serif' }}>
              {coupon.total_discount_given_formatted}
            </p>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
              <Loader2 size={24} color="#0FA3B1" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : redemptions.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <Tag size={32} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <p style={{ color: '#9CA3AF', fontSize: 14 }}>No redemptions yet</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  {['Participant', 'Order', 'Workshop', 'Discount', 'Date'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: '#9CA3AF',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {redemptions.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: '1px solid #F3F4F6' }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#111827', fontWeight: 500 }}>
                      {r.user_name || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {r.order_number ? (
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 12,
                            color: '#374151',
                          }}
                        >
                          {r.order_number}
                        </span>
                      ) : (
                        <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', maxWidth: 140 }}>
                      <span
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.workshop_title ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#15803D', fontWeight: 600 }}>
                      −{r.discount_amount_formatted}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>
                      {formatDate(r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {lastPage > 1 && (
          <div
            style={{
              padding: '12px 24px',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 13, color: '#6B7280' }}>
              Page {page} of {lastPage}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  background: 'white',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  color: page <= 1 ? '#D1D5DB' : '#374151',
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= lastPage}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  background: 'white',
                  cursor: page >= lastPage ? 'not-allowed' : 'pointer',
                  color: page >= lastPage ? '#D1D5DB' : '#374151',
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Deactivate confirmation modal ───────────────────────────────────────────

function DeactivateModal({
  coupon,
  onConfirm,
  onCancel,
  loading,
}: {
  coupon: Coupon;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: '32px',
          maxWidth: 440,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <p
          style={{
            fontFamily: 'Sora, sans-serif',
            fontSize: 18,
            fontWeight: 700,
            color: '#2E2E2E',
            margin: '0 0 12px',
          }}
        >
          Deactivate{' '}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>
            {coupon.code}
          </span>
          ?
        </p>
        <p style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.6, margin: '0 0 24px' }}>
          This coupon will stop accepting new redemptions immediately. Any existing orders are
          not affected. You can reactivate it at any time.
        </p>
        {coupon.redemption_count > 0 && (
          <p
            style={{
              fontSize: 13,
              color: '#92400E',
              backgroundColor: '#FFFBEB',
              padding: '10px 12px',
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            This coupon has been used {coupon.redemption_count} time{coupon.redemption_count !== 1 ? 's' : ''}{' '}
            and given {coupon.total_discount_given_formatted} in discounts.
          </p>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 8,
              background: loading ? '#F87171' : '#E94F37',
              color: 'white',
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}
          >
            {loading ? 'Deactivating…' : 'Deactivate'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 8,
              background: 'white',
              color: '#0FA3B1',
              border: '1px solid #0FA3B1',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}
          >
            Keep Active
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CouponsPage() {
  useSetPage('Coupons', [{ label: 'Organization' }, { label: 'Coupons' }]);

  const { currentOrg } = useUser();
  const role = currentOrg?.role ?? '';
  const canAccess = COUPON_ROLES.includes(role);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'percentage' | 'fixed_amount' | 'free'>('all');
  const [search, setSearch] = useState('');
  const searchRef = useRef('');

  // Redemptions panel
  const [redemptionCoupon, setRedemptionCoupon] = useState<Coupon | null>(null);

  // Deactivate modal
  const [deactivatingCoupon, setDeactivatingCoupon] = useState<Coupon | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Toggling active state (activate only, no modal needed)
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Bulk generate modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);

  const loadCoupons = useCallback(
    async (p: number, s: string) => {
      if (!currentOrg || !canAccess) return;
      setLoading(true);
      try {
        const filters: CouponFilters = { page: p };
        if (statusFilter === 'active') filters.is_active = true;
        if (statusFilter === 'inactive') filters.is_active = false;
        if (typeFilter !== 'all') filters.discount_type = typeFilter;
        if (s.trim()) filters.search = s.trim();

        const res = await listCoupons(currentOrg.id, filters);
        setCoupons(res.data);
        setTotal(res.meta.total);
        setLastPage(res.meta.last_page);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load coupons');
      } finally {
        setLoading(false);
      }
    },
    [currentOrg, canAccess, statusFilter, typeFilter],
  );

  useEffect(() => {
    if (!currentOrg) return;
    if (!canAccess) {
      setLoading(false);
      return;
    }
    loadCoupons(page, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg, canAccess, statusFilter, typeFilter, page]);

  useEffect(() => {
    if (!currentOrg || !canAccess) return;
    getWorkshops(currentOrg.id)
      .then((res: unknown) => {
        const data =
          Array.isArray(res)
            ? (res as Workshop[])
            : ((res as { data?: Workshop[] }).data ?? []);
        setWorkshops(data.map((w) => ({ id: w.id, title: w.title })));
      })
      .catch(() => {});
  }, [currentOrg, canAccess]);

  // Debounce search
  useEffect(() => {
    searchRef.current = search;
    const timer = setTimeout(() => {
      if (searchRef.current === search) {
        setPage(1);
        loadCoupons(1, search);
      }
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleDeactivateConfirm() {
    if (!deactivatingCoupon || !currentOrg) return;
    setDeactivating(true);
    try {
      await deactivateCoupon(currentOrg.id, deactivatingCoupon.id);
      toast.success(`Coupon ${deactivatingCoupon.code} deactivated`);
      setDeactivatingCoupon(null);
      loadCoupons(page, search);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not deactivate coupon');
    } finally {
      setDeactivating(false);
    }
  }

  async function handleActivate(coupon: Coupon) {
    if (!currentOrg) return;
    setTogglingId(coupon.id);
    try {
      const updated = await activateCoupon(currentOrg.id, coupon.id);
      setCoupons((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success(`Coupon ${coupon.code} activated`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not activate coupon');
    } finally {
      setTogglingId(null);
    }
  }

  if (!canAccess) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <Card className="py-20 px-8 flex flex-col items-center text-center">
          <p className="text-medium-gray text-sm">
            Only organization owners and admins can manage coupons.
          </p>
        </Card>
      </div>
    );
  }

  const isEmpty = !loading && coupons.length === 0 && !search && statusFilter === 'all' && typeFilter === 'all';

  return (
    <>
      <div className="max-w-[1280px] mx-auto space-y-6">
        {/* Page header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: 'Sora, sans-serif',
                fontWeight: 700,
                fontSize: 22,
                color: '#2E2E2E',
                margin: 0,
              }}
            >
              Coupons
            </h1>
            {total > 0 && (
              <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
                {total} coupon{total !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-2 border border-gray-300 text-gray-700
                font-medium px-4 py-2.5 rounded-xl text-sm hover:bg-gray-50
                transition-colors"
            >
              <Layers size={15} />
              Generate Codes
            </button>
            <Link href="/organization/coupons/new">
              <Button>
                <Plus className="w-4 h-4" />
                New Coupon
              </Button>
            </Link>
          </div>
        </div>

        {/* Analytics summary */}
        {currentOrg && <CouponAnalyticsSummary organizationId={currentOrg.id} />}

        {/* Filters */}
        <Card>
          <div
            style={{
              padding: '14px 20px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'center',
            }}
          >
            {/* Search */}
            <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9CA3AF',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code or label…"
                style={{
                  width: '100%',
                  height: 36,
                  paddingLeft: 34,
                  paddingRight: 12,
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  fontSize: 13,
                  color: '#111827',
                  outline: 'none',
                  background: 'white',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#0FA3B1')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
              />
            </div>

            {/* Status filter */}
            <div style={{ display: 'flex', gap: 0, borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
              {(['all', 'active', 'inactive'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  style={{
                    padding: '6px 14px',
                    fontSize: 13,
                    fontWeight: statusFilter === s ? 600 : 400,
                    border: 'none',
                    backgroundColor: statusFilter === s ? '#0FA3B1' : 'white',
                    color: statusFilter === s ? 'white' : '#374151',
                    cursor: 'pointer',
                    transition: 'all 150ms',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                  }}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {/* Type filter */}
            <div style={{ display: 'flex', gap: 0, borderRadius: 8, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
              {(['all', 'percentage', 'fixed_amount', 'free'] as const).map((t) => {
                const label = t === 'all' ? 'All Types' : t === 'percentage' ? '% Off' : t === 'fixed_amount' ? '$ Off' : 'Free';
                return (
                  <button
                    key={t}
                    onClick={() => { setTypeFilter(t); setPage(1); }}
                    style={{
                      padding: '6px 14px',
                      fontSize: 13,
                      fontWeight: typeFilter === t ? 600 : 400,
                      border: 'none',
                      backgroundColor: typeFilter === t ? '#0FA3B1' : 'white',
                      color: typeFilter === t ? 'white' : '#374151',
                      cursor: 'pointer',
                      transition: 'all 150ms',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card>
          {loading ? (
            <div style={{ padding: '64px 0', display: 'flex', justifyContent: 'center' }}>
              <Loader2 size={28} color="#0FA3B1" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : isEmpty ? (
            <div style={{ padding: '80px 24px', textAlign: 'center' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: '#F0FDFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <Tag size={24} color="#0FA3B1" />
              </div>
              <h3
                style={{
                  fontFamily: 'Sora, sans-serif',
                  fontWeight: 700,
                  fontSize: 16,
                  color: '#111827',
                  margin: '0 0 8px',
                }}
              >
                No coupons yet
              </h3>
              <p style={{ color: '#9CA3AF', fontSize: 14, margin: '0 0 24px' }}>
                Create your first coupon to offer discounts to participants.
              </p>
              <Link href="/organization/coupons/new">
                <Button>
                  <Plus className="w-4 h-4" />
                  Create Coupon
                </Button>
              </Link>
            </div>
          ) : coupons.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <Search size={32} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <p style={{ color: '#9CA3AF', fontSize: 14 }}>No coupons match your filters.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  {['Code', 'Type', 'Scope', 'Status', 'Usage', 'Valid Until', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: '#9CA3AF',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => {
                  const status = couponStatus(coupon);
                  const isToggling = togglingId === coupon.id;
                  return (
                    <tr
                      key={coupon.id}
                      style={{ borderBottom: '1px solid #F3F4F6' }}
                    >
                      {/* Code + label */}
                      <td style={{ padding: '14px 16px' }}>
                        <p
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontWeight: 700,
                            fontSize: 14,
                            color: '#111827',
                            letterSpacing: '0.06em',
                            margin: 0,
                          }}
                        >
                          {coupon.code}
                        </p>
                        {coupon.label && (
                          <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>
                            {coupon.label}
                          </p>
                        )}
                      </td>

                      {/* Type + discount */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {typeBadge(coupon.discount_type)}
                          <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
                            {coupon.discount_formatted}
                          </span>
                        </div>
                      </td>

                      {/* Scope */}
                      <td style={{ padding: '14px 16px', fontSize: 12, color: '#6B7280' }}>
                        {coupon.applies_to === 'all'
                          ? 'All items'
                          : coupon.applies_to === 'workshop_only'
                            ? 'Workshop only'
                            : 'Add-ons only'}
                        {coupon.workshop_title && (
                          <p
                            style={{
                              fontSize: 11,
                              color: '#9CA3AF',
                              margin: '2px 0 0',
                              maxWidth: 160,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {coupon.workshop_title}
                          </p>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        {statusBadge(status)}
                      </td>

                      {/* Usage */}
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#374151' }}>
                        <span style={{ fontWeight: 600 }}>{coupon.redemption_count}</span>
                        {coupon.max_redemptions != null && (
                          <span style={{ color: '#9CA3AF' }}> / {coupon.max_redemptions}</span>
                        )}
                        {coupon.redemption_count > 0 && (
                          <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>
                            {coupon.total_discount_given_formatted} given
                          </p>
                        )}
                      </td>

                      {/* Valid until */}
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {formatDate(coupon.valid_until)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <Link
                            href={`/organization/coupons/${coupon.id}/edit`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              height: 32,
                              padding: '0 12px',
                              borderRadius: 8,
                              border: '1px solid #E5E7EB',
                              background: 'white',
                              fontSize: 13,
                              fontWeight: 500,
                              color: '#374151',
                              textDecoration: 'none',
                              transition: 'border-color 150ms',
                            }}
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => setRedemptionCoupon(coupon)}
                            disabled={coupon.redemption_count === 0}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              height: 32,
                              padding: '0 12px',
                              borderRadius: 8,
                              border: '1px solid #E5E7EB',
                              background: 'white',
                              fontSize: 13,
                              fontWeight: 500,
                              color: coupon.redemption_count === 0 ? '#D1D5DB' : '#374151',
                              cursor: coupon.redemption_count === 0 ? 'not-allowed' : 'pointer',
                              transition: 'border-color 150ms',
                              fontFamily: 'Plus Jakarta Sans, sans-serif',
                            }}
                          >
                            {coupon.redemption_count > 0
                              ? `${coupon.redemption_count} use${coupon.redemption_count !== 1 ? 's' : ''}`
                              : 'No uses'}
                          </button>
                          {coupon.is_active ? (
                            <button
                              onClick={() => setDeactivatingCoupon(coupon)}
                              disabled={isToggling}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                height: 32,
                                padding: '0 12px',
                                borderRadius: 8,
                                border: '1px solid #FCA5A5',
                                background: 'white',
                                fontSize: 13,
                                fontWeight: 500,
                                color: '#EF4444',
                                cursor: isToggling ? 'not-allowed' : 'pointer',
                                transition: 'all 150ms',
                                fontFamily: 'Plus Jakarta Sans, sans-serif',
                              }}
                            >
                              {isToggling ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Deactivate'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivate(coupon)}
                              disabled={isToggling}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                height: 32,
                                padding: '0 12px',
                                borderRadius: 8,
                                border: '1px solid #86EFAC',
                                background: '#F0FDF4',
                                fontSize: 13,
                                fontWeight: 500,
                                color: '#16A34A',
                                cursor: isToggling ? 'not-allowed' : 'pointer',
                                transition: 'all 150ms',
                                fontFamily: 'Plus Jakarta Sans, sans-serif',
                              }}
                            >
                              {isToggling ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : 'Activate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {!loading && lastPage > 1 && (
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid #E5E7EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 13, color: '#6B7280' }}>
                Page {page} of {lastPage} · {total} total
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    background: 'white',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    color: page <= 1 ? '#D1D5DB' : '#374151',
                  }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={page >= lastPage}
                  onClick={() => setPage((p) => p + 1)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    background: 'white',
                    cursor: page >= lastPage ? 'not-allowed' : 'pointer',
                    color: page >= lastPage ? '#D1D5DB' : '#374151',
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Redemptions slide-over */}
      {redemptionCoupon && currentOrg && (
        <RedemptionsPanel
          coupon={redemptionCoupon}
          organizationId={currentOrg.id}
          onClose={() => setRedemptionCoupon(null)}
        />
      )}

      {/* Deactivate modal */}
      {deactivatingCoupon && (
        <DeactivateModal
          coupon={deactivatingCoupon}
          onConfirm={handleDeactivateConfirm}
          onCancel={() => setDeactivatingCoupon(null)}
          loading={deactivating}
        />
      )}

      {/* Bulk generate modal */}
      {showBulkModal && currentOrg && (
        <BulkGenerateModal
          organizationId={currentOrg.id}
          workshops={workshops}
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => loadCoupons(1, search)}
        />
      )}
    </>
  );
}

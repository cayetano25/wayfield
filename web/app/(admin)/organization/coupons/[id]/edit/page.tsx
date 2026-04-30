'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { ApiError } from '@/lib/api/client';
import { getCoupon, type Coupon } from '@/lib/api/coupons';
import { CouponForm } from '@/components/coupons/CouponForm';
import { Card } from '@/components/ui/Card';

const COUPON_ROLES = ['owner', 'admin'];

export default function EditCouponPage() {
  useSetPage('Edit Coupon', [
    { label: 'Organization' },
    { label: 'Coupons', href: '/organization/coupons' },
    { label: 'Edit' },
  ]);

  const params = useParams<{ id: string }>();
  const { currentOrg } = useUser();
  const role = currentOrg?.role ?? '';
  const canAccess = COUPON_ROLES.includes(role);

  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const loadCoupon = useCallback(async () => {
    if (!currentOrg || !canAccess) return;
    try {
      const id = parseInt(params.id);
      if (isNaN(id)) { setNotFound(true); return; }
      const data = await getCoupon(currentOrg.id, id);
      setCoupon(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        toast.error('Failed to load coupon');
      }
    } finally {
      setLoading(false);
    }
  }, [currentOrg, canAccess, params.id]);

  useEffect(() => {
    if (!currentOrg) return;
    if (!canAccess) { setLoading(false); return; }
    loadCoupon();
  }, [currentOrg, canAccess, loadCoupon]);

  if (!canAccess) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <Card className="py-20 px-8 flex flex-col items-center text-center">
          <p className="text-medium-gray text-sm">
            Only organization owners and admins can edit coupons.
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <Card className="py-20 flex items-center justify-center">
          <Loader2 size={28} color="#0FA3B1" style={{ animation: 'spin 1s linear infinite' }} />
        </Card>
      </div>
    );
  }

  if (notFound || !coupon) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <Card className="py-20 px-8 flex flex-col items-center text-center">
          <p className="text-medium-gray text-sm">Coupon not found.</p>
        </Card>
      </div>
    );
  }

  if (!currentOrg) return null;

  return (
    <div className="max-w-[1280px] mx-auto space-y-6">
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
          Edit{' '}
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.06em',
              color: '#0FA3B1',
            }}
          >
            {coupon.code}
          </span>
        </h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
          {coupon.redemption_count > 0
            ? `${coupon.redemption_count} redemption${coupon.redemption_count !== 1 ? 's' : ''} · ${coupon.total_discount_given_formatted} given`
            : 'No redemptions yet'}
        </p>
      </div>

      <CouponForm organizationId={currentOrg.id} coupon={coupon} />
    </div>
  );
}

'use client';

import { useUser } from '@/contexts/UserContext';
import { useSetPage } from '@/contexts/PageContext';
import { CouponForm } from '@/components/coupons/CouponForm';
import { Card } from '@/components/ui/Card';

const COUPON_ROLES = ['owner', 'admin'];

export default function NewCouponPage() {
  useSetPage('New Coupon', [
    { label: 'Organization' },
    { label: 'Coupons', href: '/organization/coupons' },
    { label: 'New' },
  ]);

  const { currentOrg } = useUser();
  const role = currentOrg?.role ?? '';
  const canAccess = COUPON_ROLES.includes(role);

  if (!canAccess) {
    return (
      <div className="max-w-[1280px] mx-auto">
        <Card className="py-20 px-8 flex flex-col items-center text-center">
          <p className="text-medium-gray text-sm">
            Only organization owners and admins can create coupons.
          </p>
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
          New Coupon
        </h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
          Create a discount code for participants.
        </p>
      </div>

      <CouponForm organizationId={currentOrg.id} />
    </div>
  );
}

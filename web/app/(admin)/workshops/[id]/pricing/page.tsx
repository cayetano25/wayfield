'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet, ApiError } from '@/lib/api/client';
import { WorkshopPricingSection } from '@/components/workshops/pricing/WorkshopPricingSection';

interface WorkshopBasic {
  id: number;
  title: string;
  start_date: string;
}

interface StripeStatusData {
  payments_enabled_for_org: boolean;
}

export default function WorkshopPricingPage() {
  const { id } = useParams<{ id: string }>();
  const { setPage } = usePage();
  const { currentOrg } = useUser();

  const [workshop, setWorkshop] = useState<WorkshopBasic | null>(null);
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    try {
      const [wRes, stripeRes] = await Promise.allSettled([
        apiGet<WorkshopBasic>(`/workshops/${id}`),
        apiGet<{ data: StripeStatusData }>(`/organizations/${currentOrg.id}/stripe/status`),
      ]);

      if (wRes.status === 'fulfilled') {
        setWorkshop(wRes.value);
        setPage(wRes.value.title, [
          { label: 'Workshops', href: '/workshops' },
          { label: wRes.value.title, href: `/workshops/${id}` },
          { label: 'Pricing' },
        ]);
      } else {
        setPage('Pricing', [
          { label: 'Workshops', href: '/workshops' },
          { label: 'Pricing' },
        ]);
      }

      if (stripeRes.status === 'fulfilled') {
        setPaymentsEnabled(stripeRes.value.data.payments_enabled_for_org);
      } else if (
        stripeRes.status === 'rejected' &&
        stripeRes.reason instanceof ApiError &&
        stripeRes.reason.status === 403
      ) {
        // billing_admin or role without access — treat as disabled
        setPaymentsEnabled(false);
      } else {
        // Stripe status unavailable — optimistically allow, the section handles errors
        setPaymentsEnabled(true);
      }
    } catch {
      toast.error('Failed to load pricing page');
    } finally {
      setLoading(false);
    }
  }, [id, currentOrg, setPage]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="max-w-[720px] mx-auto space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-2xl border border-gray-200 animate-pulse" />
        ))}
      </div>
    );
  }

  if (paymentsEnabled === false) {
    return (
      <div className="max-w-[720px] mx-auto">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <CreditCard className="text-gray-400" size={22} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-1">
              Payment collection is not yet enabled for your organization.
            </p>
            <p className="text-sm text-gray-500 leading-relaxed">
              Contact support to enable payments, or connect a Stripe account in your{' '}
              <a href="/organization/settings/payments" className="text-[#0FA3B1] hover:underline">
                payment settings
              </a>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto">
      <div className="mb-6">
        <h1 className="font-heading text-xl font-semibold text-dark">Workshop Pricing</h1>
        <p className="text-sm text-medium-gray mt-1">
          Configure registration fees, deposits, and your refund policy.
        </p>
      </div>

      {workshop && (
        <WorkshopPricingSection
          workshopId={workshop.id}
          workshopStartDate={workshop.start_date}
          planCode={currentOrg?.plan_code ?? 'free'}
        />
      )}
    </div>
  );
}

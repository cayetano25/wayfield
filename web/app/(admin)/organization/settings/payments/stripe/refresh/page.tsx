'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiPost, ApiError } from '@/lib/api/client';

export default function StripeRefreshPage() {
  useSetPage('Payments', [
    { label: 'Organization' },
    { label: 'Settings', href: '/organization/settings' },
    { label: 'Payments', href: '/organization/settings/payments' },
    { label: 'Refreshing link…' },
  ]);

  const { currentOrg } = useUser();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current || !currentOrg) return;
    attempted.current = true;

    async function refreshLink() {
      try {
        const res = await apiPost<{ data: { account_link_url: string } }>(
          `/organizations/${currentOrg!.id}/stripe/refresh-link`,
        );
        window.location.href = res.data.account_link_url;
      } catch (err) {
        if (err instanceof ApiError) {
          setError(
            err.message ||
              'Unable to refresh setup link. Please try again from Settings.',
          );
        } else {
          setError('Unable to refresh setup link. Please try again from Settings.');
        }
      }
    }

    refreshLink();
  }, [currentOrg]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="font-heading text-lg font-bold text-dark mb-2">
            Could not refresh setup link
          </h1>
          <p className="text-sm text-medium-gray leading-relaxed mb-6">{error}</p>
          <Link
            href="/organization/settings/payments"
            className="inline-flex items-center justify-center h-10 px-5 rounded-lg
              bg-primary text-white text-sm font-semibold hover:bg-[#0c8a96] transition-colors"
          >
            Return to Payment Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
        <p className="text-sm font-medium text-dark">Generating a new setup link…</p>
        <p className="text-xs text-medium-gray mt-1">
          You&apos;ll be taken to Stripe automatically.
        </p>
      </div>
    </div>
  );
}

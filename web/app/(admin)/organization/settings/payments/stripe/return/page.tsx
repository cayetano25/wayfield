'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useSetPage } from '@/contexts/PageContext';
import { useUser } from '@/contexts/UserContext';
import { apiGet, ApiError } from '@/lib/api/client';

interface StripeStatusData {
  connected: boolean;
  charges_enabled: boolean;
}

type ReturnState = 'checking' | 'success' | 'pending';

export default function StripeReturnPage() {
  useSetPage('Payments', [
    { label: 'Organization' },
    { label: 'Settings', href: '/organization/settings' },
    { label: 'Payments', href: '/organization/settings/payments' },
    { label: 'Connecting…' },
  ]);

  const { currentOrg } = useUser();
  const router = useRouter();
  const [returnState, setReturnState] = useState<ReturnState>('checking');
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current || !currentOrg) return;
    checked.current = true;

    async function checkStatus() {
      try {
        const res = await apiGet<{ data: StripeStatusData }>(
          `/organizations/${currentOrg!.id}/stripe/status`,
        );
        setReturnState(res.data.charges_enabled ? 'success' : 'pending');
      } catch (err) {
        // On any error treat as pending — the status page will show the real state
        if (!(err instanceof ApiError && err.status === 401)) {
          setReturnState('pending');
        }
      }
    }

    checkStatus();
  }, [currentOrg]);

  // Redirect to payments settings after the result has been shown for 3 seconds
  useEffect(() => {
    if (returnState === 'checking') return;
    const t = setTimeout(() => {
      router.push('/organization/settings/payments');
    }, 3000);
    return () => clearTimeout(t);
  }, [returnState, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      {/* ── Checking ── */}
      {returnState === 'checking' && (
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm font-medium text-dark">Checking your account status…</p>
          <p className="text-xs text-medium-gray mt-1">This only takes a moment.</p>
        </div>
      )}

      {/* ── Success ── */}
      {returnState === 'success' && (
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="font-heading text-xl font-bold text-dark mb-2">
            Your account is connected!
          </h1>
          <p className="text-sm text-medium-gray">
            You&apos;re all set to accept payments for your workshops.
          </p>
          <p className="text-xs text-light-gray mt-5">
            Redirecting you to payment settings…
          </p>
        </div>
      )}

      {/* ── Still pending ── */}
      {returnState === 'pending' && (
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="font-heading text-xl font-bold text-dark mb-2">
            Almost there
          </h1>
          <p className="text-sm text-medium-gray leading-relaxed">
            Your Stripe account still needs a few more details before payments
            are enabled. You can complete setup from your payment settings.
          </p>
          <Link
            href="/organization/settings/payments"
            className="inline-block mt-6 text-sm font-semibold text-primary hover:underline underline-offset-2"
          >
            Complete setup →
          </Link>
          <p className="text-xs text-light-gray mt-4">
            Or wait — redirecting automatically…
          </p>
        </div>
      )}
    </div>
  );
}

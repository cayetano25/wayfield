'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Lock, AlertCircle, Star } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { getWaitlistPaymentIntent, type WaitlistPaymentIntent } from '@/lib/api/waitlist';
import { ApiError } from '@/lib/api/client';
import { formatCents } from '@/lib/utils/currency';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// ─── Countdown Timer ──────────────────────────────────────────────────────────

function CountdownTimer({
  expiresAt,
  onExpired,
}: {
  expiresAt: string;
  onExpired: () => void;
}) {
  const [remaining, setRemaining] = useState<number>(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  );
  const expiredRef = useRef(false);

  useEffect(() => {
    if (remaining <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpired();
      }
      return;
    }

    const id = setInterval(() => {
      setRemaining((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0 && !expiredRef.current) {
          expiredRef.current = true;
          onExpired();
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [expiresAt, onExpired, remaining]);

  const hours   = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const isUrgent = remaining < 3600;

  return (
    <p
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 22,
        fontWeight: 700,
        textAlign: 'center',
        marginTop: 8,
        letterSpacing: '0.05em',
        color: isUrgent ? '#DC2626' : '#0FA3B1',
        transition: 'color 500ms',
      }}
    >
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </p>
  );
}

// ─── Payment form (inside Stripe Elements) ────────────────────────────────────

function WaitlistPaymentForm({
  amount,
  workshopTitle,
  workshopSlug,
}: {
  amount: number;
  workshopTitle: string;
  workshopSlug: string;
}) {
  const stripe    = useStripe();
  const elements  = useElements();
  const router    = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!stripe || !elements || isProcessing) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message ?? 'Payment failed. Please try again.');
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      router.push(`/w/${workshopSlug}?waitlist_paid=true`);
    } else {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <PaymentElement options={{ layout: 'tabs' }} />

      {errorMessage && (
        <p
          role="alert"
          aria-live="polite"
          style={{
            fontSize: 14,
            color: '#DC2626',
            marginTop: 12,
            padding: '10px 14px',
            backgroundColor: '#FEF2F2',
            borderRadius: 8,
            border: '1px solid #FECACA',
          }}
        >
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isProcessing || !stripe || !elements}
        aria-busy={isProcessing}
        style={{
          width: '100%',
          marginTop: 20,
          padding: '16px 0',
          borderRadius: 12,
          backgroundColor: isProcessing || !stripe ? '#D1D5DB' : '#0FA3B1',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: 16,
          border: 'none',
          cursor: isProcessing || !stripe ? 'not-allowed' : 'pointer',
          transition: 'background-color 150ms',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
        onMouseEnter={(e) => {
          if (!isProcessing && stripe) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0c8a96';
          }
        }}
        onMouseLeave={(e) => {
          if (!isProcessing && stripe) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0FA3B1';
          }
        }}
      >
        {isProcessing ? (
          <>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            Processing…
          </>
        ) : (
          <>Secure my spot · {formatCents(amount)}</>
        )}
      </button>

      <p
        style={{
          textAlign: 'center',
          fontSize: 12,
          color: '#9CA3AF',
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <Lock size={11} />
        Secured by Stripe
      </p>
    </div>
  );
}

// ─── Expired state ────────────────────────────────────────────────────────────

function WindowExpiredState() {
  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          backgroundColor: '#FEF2F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}
      >
        <AlertCircle size={32} color="#DC2626" />
      </div>
      <h1
        style={{
          fontFamily: 'Sora, sans-serif',
          fontWeight: 700,
          fontSize: 22,
          color: '#111827',
          margin: '0 0 10px',
        }}
      >
        This spot is no longer available.
      </h1>
      <p style={{ fontSize: 15, color: '#6B7280', margin: '0 0 8px', lineHeight: 1.6 }}>
        This spot has been given to the next participant on the waitlist.
      </p>
      <p style={{ fontSize: 14, color: '#9CA3AF', margin: '0 0 28px', lineHeight: 1.6 }}>
        You&apos;re still on the waitlist and will be notified if another spot opens.
      </p>
      <Link
        href="/my-workshops"
        style={{
          display: 'inline-block',
          padding: '12px 28px',
          borderRadius: 12,
          backgroundColor: '#F3F4F6',
          color: '#374151',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontWeight: 600,
          fontSize: 15,
          textDecoration: 'none',
        }}
      >
        Go to My Workshops
      </Link>
    </div>
  );
}

// ─── No window state ──────────────────────────────────────────────────────────

function NoWindowState() {
  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          backgroundColor: '#F3F4F6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}
      >
        <AlertCircle size={32} color="#9CA3AF" />
      </div>
      <h1
        style={{
          fontFamily: 'Sora, sans-serif',
          fontWeight: 700,
          fontSize: 22,
          color: '#111827',
          margin: '0 0 10px',
        }}
      >
        No active payment window
      </h1>
      <p style={{ fontSize: 15, color: '#6B7280', margin: '0 0 28px', lineHeight: 1.6 }}>
        You don&apos;t have an active waitlist spot to pay for. Check your email for an invitation link.
      </p>
      <Link
        href="/my-workshops"
        style={{
          display: 'inline-block',
          padding: '12px 28px',
          borderRadius: 12,
          backgroundColor: '#0FA3B1',
          color: '#ffffff',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontWeight: 700,
          fontSize: 15,
          textDecoration: 'none',
        }}
      >
        Go to My Workshops
      </Link>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WaitlistPaymentPage() {
  const params        = useParams();
  const workshopSlug  = params.workshopSlug as string;

  const [intent, setIntent]             = useState<WaitlistPaymentIntent | null>(null);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [isLoading, setIsLoading]       = useState(true);
  const [pageState, setPageState]       = useState<
    'loading' | 'form' | 'no_window' | 'window_expired' | 'error'
  >('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [liveExpired, setLiveExpired]   = useState(false);

  const clientSecretRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await getWaitlistPaymentIntent(workshopSlug);

        if (cancelled) return;

        setIntent(data);
        clientSecretRef.current = data.client_secret;

        const stripe = loadStripe(data.stripe_publishable_key);
        setStripePromise(stripe);
        setPageState('form');
      } catch (err: unknown) {
        if (cancelled) return;

        if (err instanceof ApiError) {
          if (err.status === 404) {
            setPageState('no_window');
          } else if (err.status === 422) {
            setPageState('window_expired');
          } else {
            setPageState('error');
            setErrorMessage('Could not load payment details. Please try again.');
          }
          setIsLoading(false);
          return;
        }

        setPageState('error');
        setErrorMessage('Could not load payment details. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [workshopSlug]);

  if (isLoading || pageState === 'loading') {
    return (
      <div
        style={{
          minHeight: 'calc(100vh - 56px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader2 size={32} color="#0FA3B1" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (pageState === 'no_window') return <NoWindowState />;
  if (pageState === 'window_expired' || liveExpired) return <WindowExpiredState />;

  if (pageState === 'error' || !intent) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <AlertCircle size={40} color="#E94F37" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontSize: 15, color: '#374151', margin: '0 0 24px' }}>
          {errorMessage ?? 'Something went wrong. Please try again.'}
        </p>
        <Link
          href="/my-workshops"
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            borderRadius: 12,
            backgroundColor: '#0FA3B1',
            color: '#ffffff',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontWeight: 700,
            fontSize: 15,
            textDecoration: 'none',
          }}
        >
          Go to My Workshops
        </Link>
      </div>
    );
  }

  const clientSecret   = clientSecretRef.current;
  const workshopTitle  = intent.workshop_title ?? 'this workshop';
  const expiresAt      = intent.window_expires_at;

  const stripeAppearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#0FA3B1',
      colorText: '#2E2E2E',
      borderRadius: '12px',
      fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
    },
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="max-w-md mx-auto py-16 px-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: '#CCEFF2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Star size={32} color="#0FA3B1" />
          </div>
          <h1
            style={{
              fontFamily: 'Sora, sans-serif',
              fontWeight: 700,
              fontSize: 24,
              color: '#111827',
              margin: '0 0 8px',
            }}
          >
            You&apos;re off the waitlist!
          </h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
            A spot opened up in <strong>{workshopTitle}</strong>.
            Complete your registration to secure it.
          </p>
        </div>

        {/* Countdown window */}
        <div
          style={{
            borderRadius: 16,
            border: '2px solid #0FA3B1',
            backgroundColor: '#F0FBFC',
            padding: '16px',
            marginBottom: 24,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#0FA3B1',
              margin: '0 0 4px',
            }}
          >
            Your spot is reserved until
          </p>
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#0FA3B1',
              margin: '0 0 2px',
            }}
          >
            {formatDateTime(expiresAt)}
          </p>
          <CountdownTimer
            expiresAt={expiresAt}
            onExpired={() => setLiveExpired(true)}
          />
        </div>

        {/* Amount */}
        <div
          style={{
            borderRadius: 16,
            border: '1px solid #E5E7EB',
            backgroundColor: '#ffffff',
            padding: '20px',
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>Registration fee</span>
            <span style={{ fontWeight: 700, fontSize: 20, color: '#0FA3B1' }}>
              {formatCents(intent.amount_cents)}
            </span>
          </div>
        </div>

        {/* Stripe payment form — only shown when window is still open */}
        {!liveExpired && stripePromise && clientSecret && (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: stripeAppearance }}
          >
            <WaitlistPaymentForm
              amount={intent.amount_cents}
              workshopTitle={workshopTitle}
              workshopSlug={workshopSlug}
            />
          </Elements>
        )}
      </div>
    </>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Lock, AlertCircle } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { getBalancePaymentIntent, type BalancePaymentIntent } from '@/lib/api/cart';
import { ApiError } from '@/lib/api/client';
import { formatCents } from '@/lib/utils/currency';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

// ─── Balance payment form (inside Stripe Elements) ────────────────────────────

function BalancePaymentForm({
  amount,
  orderNumber,
}: {
  amount: number;
  orderNumber: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
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
      router.push(`/orders/${orderNumber}?balance_paid=true`);
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
          <>Pay {formatCents(amount)}</>
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

// ─── States ───────────────────────────────────────────────────────────────────

function AlreadyPaidState() {
  return (
    <div className="max-w-md mx-auto py-16 px-4 text-center">
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          backgroundColor: '#DCFCE7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
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
        Balance already paid
      </h1>
      <p style={{ fontSize: 15, color: '#6B7280', margin: '0 0 28px', lineHeight: 1.6 }}>
        Your balance has already been paid. You&apos;re all set!
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

function ExpiredState() {
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
        Payment link expired
      </h1>
      <p style={{ fontSize: 15, color: '#6B7280', margin: '0 0 8px', lineHeight: 1.6 }}>
        This payment link has expired. Your registration was cancelled and your deposit has been forfeited.
      </p>
      <p style={{ fontSize: 14, color: '#9CA3AF', margin: '0 0 28px' }}>
        Please contact the organizer if you have questions.
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BalancePaymentPage() {
  const params = useParams();
  const orderNumber = params.orderNumber as string;

  const [intent, setIntent] = useState<BalancePaymentIntent | null>(null);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageState, setPageState] = useState<'loading' | 'form' | 'already_paid' | 'expired' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientSecretRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const intentData = await getBalancePaymentIntent(orderNumber);

        if (cancelled) return;

        setIntent(intentData);

        // client_secret lives only in memory — never persisted
        clientSecretRef.current = intentData.client_secret;

        const stripe = loadStripe(intentData.stripe_publishable_key);
        setStripePromise(stripe);
        setPageState('form');
      } catch (err: unknown) {
        if (cancelled) return;

        if (err instanceof ApiError && err.status === 422) {
          const msg = err.message ?? '';
          if (msg.includes('already been paid')) {
            setPageState('already_paid');
          } else {
            // grace period expired, cancelled, or no balance — all show expired state
            setPageState('expired');
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
  }, [orderNumber]);

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

  if (pageState === 'already_paid') return <AlreadyPaidState />;
  if (pageState === 'expired') return <ExpiredState />;

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

  const clientSecret = clientSecretRef.current;
  const daysUntilExpiry = intent.days_until_expiry;

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
        <div className="text-center mb-8">
          <p
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: '#9CA3AF',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              margin: '0 0 6px',
            }}
          >
            Balance Payment
          </p>
          <h1
            style={{
              fontFamily: 'Sora, sans-serif',
              fontWeight: 700,
              fontSize: 24,
              color: '#111827',
              margin: 0,
            }}
          >
            Complete your registration
          </h1>
        </div>

        {/* Order summary card */}
        <div
          style={{
            borderRadius: 16,
            border: '1px solid #E5E7EB',
            backgroundColor: '#ffffff',
            padding: '20px',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13, color: '#6B7280' }}>Workshop</span>
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: '#111827',
                textAlign: 'right',
                maxWidth: 220,
              }}
            >
              {intent.workshop_title ?? 'Workshop'}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 13, color: '#6B7280' }}>Deposit paid</span>
            <span style={{ fontSize: 13, color: '#16A34A', fontWeight: 500 }}>
              ✓ {formatCents(intent.deposit_amount_cents)}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 16,
              borderTop: '1px solid #E5E7EB',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>Balance due today</span>
            <span
              style={{
                fontWeight: 700,
                fontSize: 20,
                color: '#0FA3B1',
              }}
            >
              {formatCents(intent.amount_cents)}
            </span>
          </div>

          {daysUntilExpiry <= 3 && (
            <div
              style={{
                marginTop: 14,
                borderRadius: 10,
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                padding: '12px 14px',
              }}
            >
              <p style={{ fontSize: 13, color: '#B91C1C', fontWeight: 500, margin: 0 }}>
                ⚠ Your spot expires in{' '}
                {daysUntilExpiry === 0
                  ? 'less than 24 hours'
                  : `${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`}
                . Complete payment to secure your place.
              </p>
            </div>
          )}

          {intent.balance_due_date && daysUntilExpiry > 3 && (
            <p
              style={{
                fontSize: 12,
                color: '#9CA3AF',
                marginTop: 10,
                textAlign: 'right',
              }}
            >
              Due by {formatDateLong(intent.balance_due_date)}
            </p>
          )}
        </div>

        {/* Stripe Elements */}
        {stripePromise && clientSecret && (
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: stripeAppearance }}
          >
            <BalancePaymentForm
              amount={intent.amount_cents}
              orderNumber={orderNumber}
            />
          </Elements>
        )}
      </div>
    </>
  );
}

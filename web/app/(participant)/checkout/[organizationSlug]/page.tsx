'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lock,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { getCart, checkoutCart, type Cart, type CheckoutResult } from '@/lib/api/cart';
import { apiGet } from '@/lib/api/client';
import { useCart } from '@/contexts/CartContext';
import { formatCents } from '@/lib/utils/currency';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgInfo {
  id: number;
  name: string;
  slug: string;
}

interface WorkshopPricing {
  commitment_date: string | null;
  commitment_description: string | null;
  post_commitment_refund_pct: number | null;
  balance_due_date: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Order Summary (shared between free + paid layouts) ───────────────────────

function OrderSummarySection({
  cart,
  orgName,
  pricingData,
}: {
  cart: Cart;
  orgName: string;
  pricingData: WorkshopPricing | null;
}) {
  const [refundOpen, setRefundOpen] = useState(false);
  const fees = cart.fee_breakdown;
  const totalFees = fees ? fees.total_fee_cents : 0;
  const total = cart.subtotal_cents + totalFees;

  return (
    <div>
      <h1
        style={{
          fontFamily: 'Sora, sans-serif',
          fontWeight: 700,
          fontSize: 22,
          color: '#111827',
          margin: '0 0 4px',
        }}
      >
        Complete your order
      </h1>
      <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px' }}>from {orgName}</p>

      {/* Items */}
      <div style={{ borderTop: '1px solid #F3F4F6' }}>
        {cart.items.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '16px 0',
              borderBottom: '1px solid #F3F4F6',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              <p
                style={{
                  fontWeight: 600,
                  fontSize: 15,
                  color: '#111827',
                  margin: '0 0 3px',
                }}
              >
                {item.workshop_title ?? item.session_title ?? 'Item'}
              </p>
              <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                {item.item_type === 'addon_session'
                  ? 'Add-on session'
                  : 'Workshop registration'}
              </p>
              {item.is_deposit && item.balance_amount_cents != null && (
                <p
                  style={{
                    fontSize: 12,
                    color: '#92400E',
                    marginTop: 6,
                    backgroundColor: '#FFFBEB',
                    borderRadius: 6,
                    padding: '3px 8px',
                    display: 'inline-block',
                  }}
                >
                  Deposit — Balance of {formatCents(item.balance_amount_cents)} due{' '}
                  {formatDate(item.balance_due_date)}
                </p>
              )}
            </div>
            <span
              style={{ fontWeight: 700, fontSize: 15, color: '#111827', whiteSpace: 'nowrap' }}
            >
              {item.unit_price_cents === 0 ? 'Free' : formatCents(item.unit_price_cents)}
            </span>
          </div>
        ))}
      </div>

      {/* Fee breakdown */}
      {cart.subtotal_cents > 0 && (
        <div
          style={{
            backgroundColor: '#F9FAFB',
            borderRadius: 12,
            padding: 16,
            marginTop: 16,
            fontSize: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: '#6B7280',
              marginBottom: 8,
            }}
          >
            <span>Subtotal</span>
            <span>{formatCents(cart.subtotal_cents)}</span>
          </div>
          {fees && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: '#6B7280',
                marginBottom: 8,
              }}
            >
              <span>Processing fee</span>
              <span>{formatCents(fees.total_fee_cents)}</span>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              color: '#111827',
              paddingTop: 10,
              borderTop: '1px solid #E5E7EB',
              fontSize: 15,
            }}
          >
            <span>Total due today</span>
            <span>{total === 0 ? 'Free' : formatCents(total)}</span>
          </div>
        </div>
      )}

      {/* Commitment date notice */}
      {pricingData?.commitment_date && (
        <div
          style={{
            borderRadius: 12,
            border: '1px solid #FDE68A',
            backgroundColor: '#FFFBEB',
            padding: 16,
            marginTop: 16,
            display: 'flex',
            gap: 12,
          }}
        >
          <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p
              style={{ fontWeight: 600, color: '#78350F', fontSize: 13, margin: '0 0 4px' }}
            >
              Important: Cancellation policy
            </p>
            {pricingData.commitment_description && (
              <p style={{ fontSize: 13, color: '#92400E', margin: '0 0 6px', lineHeight: 1.5 }}>
                {pricingData.commitment_description}
              </p>
            )}
            {pricingData.post_commitment_refund_pct != null && (
              <p style={{ fontSize: 12, color: '#B45309', margin: 0 }}>
                After {formatDate(pricingData.commitment_date)},{' '}
                {pricingData.post_commitment_refund_pct}% refund policy applies.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Refund policy collapsed */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => setRefundOpen((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: '#6B7280',
            fontSize: 13,
            padding: 0,
          }}
          aria-expanded={refundOpen}
        >
          {refundOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {refundOpen ? 'Hide' : 'View'} refund policy
        </button>
        {refundOpen && (
          <div
            style={{
              marginTop: 10,
              padding: 14,
              backgroundColor: '#F9FAFB',
              borderRadius: 10,
              fontSize: 13,
              color: '#4B5563',
              lineHeight: 1.6,
            }}
          >
            Refund policies are set by the organizer. Please contact them directly for
            specific refund questions about your registration.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stripe payment form ───────────────────────────────────────────────────────

function StripePaymentForm({
  total,
  orderNumber,
  onSuccess,
}: {
  total: number;
  orderNumber: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!stripe || !elements || isProcessing) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      // Stripe provides user-friendly, specific error messages
      setErrorMessage(error.message ?? 'Payment failed. Please try again.');
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      onSuccess();
      router.push(`/orders/${orderNumber}?status=success`);
    } else {
      // Stripe handles redirects automatically for 3DS etc.
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      {/* Inline error */}
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
          <>Pay {total === 0 ? 'Free' : formatCents(total)}</>
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

// ─── Free checkout button ──────────────────────────────────────────────────────

function FreeCheckoutButton({
  organizationId,
  onDone,
}: {
  organizationId: number;
  onDone: (orderNumber: string) => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await checkoutCart(organizationId);
      if (!result.requires_payment) {
        onDone(result.order_number);
      }
    } catch (e: unknown) {
      setError('Something went wrong. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      {error && (
        <p
          role="alert"
          style={{
            fontSize: 14,
            color: '#DC2626',
            marginBottom: 12,
            padding: '10px 14px',
            backgroundColor: '#FEF2F2',
            borderRadius: 8,
            border: '1px solid #FECACA',
          }}
        >
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleComplete}
        disabled={isProcessing}
        aria-busy={isProcessing}
        style={{
          width: '100%',
          padding: '16px 0',
          borderRadius: 12,
          backgroundColor: isProcessing ? '#D1D5DB' : '#0FA3B1',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: 16,
          border: 'none',
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
      >
        {isProcessing ? (
          <>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            Completing…
          </>
        ) : (
          <>
            <CheckCircle size={18} />
            Complete Registration
          </>
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
        Secure checkout
      </p>
    </div>
  );
}

// ─── Main checkout page ───────────────────────────────────────────────────────

export default function CheckoutPage() {
  const params = useParams<{ organizationSlug: string }>();
  const organizationSlug = params.organizationSlug;
  const router = useRouter();
  const { clearCart } = useCart();

  const [cart, setCart] = useState<Cart | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [pricingData, setPricingData] = useState<WorkshopPricing | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [isLoadingCart, setIsLoadingCart] = useState(true);
  const [isInitiatingCheckout, setIsInitiatingCheckout] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  // client_secret lives only in React state — never in localStorage or sessionStorage
  const clientSecretRef = useRef<string | null>(null);

  // Load cart and org info
  useEffect(() => {
    async function load() {
      setIsLoadingCart(true);
      try {
        // Resolve org by slug
        const orgData = await apiGet<OrgInfo>(`/organizations/by-slug/${organizationSlug}`);
        setOrg(orgData);

        const cartData = await getCart(orgData.id);
        setCart(cartData);

        if (cartData.items.length === 0) {
          router.replace('/my-workshops');
          return;
        }

        // Load pricing for commitment date info (first workshop item)
        const workshopItem = cartData.items.find((i) => i.item_type === 'workshop_registration');
        if (workshopItem?.workshop_id) {
          try {
            const pricing = await apiGet<WorkshopPricing>(
              `/workshops/${workshopItem.workshop_id}/pricing`,
            );
            setPricingData(pricing);
          } catch {
            // pricing is optional
          }
        }
      } catch {
        setPageError('Could not load your cart. Please try again.');
      } finally {
        setIsLoadingCart(false);
      }
    }
    load();
  }, [organizationSlug, router]);

  // Initiate checkout once cart is loaded
  useEffect(() => {
    if (!cart || !org || isInitiatingCheckout || checkoutResult) return;
    if (cart.items.length === 0) return;

    async function initiateCheckout() {
      setIsInitiatingCheckout(true);
      try {
        const result = await checkoutCart(org!.id);
        setCheckoutResult(result);

        if (result.requires_payment) {
          // Store client_secret only in memory — never persisted
          clientSecretRef.current = result.client_secret;

          // Initialize Stripe with the connected account
          const stripe = loadStripe(result.stripe_publishable_key);
          setStripePromise(stripe);
        }
      } catch (e: unknown) {
        const msg =
          e instanceof Error ? e.message : 'Could not initiate checkout. Please try again.';
        setPageError(msg);
      } finally {
        setIsInitiatingCheckout(false);
      }
    }
    initiateCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, org]);

  const handleFreeSuccess = useCallback(
    (orderNumber: string) => {
      clearCart();
      router.push(`/orders/${orderNumber}?status=success`);
    },
    [clearCart, router],
  );

  const handlePaidSuccess = useCallback(() => {
    clearCart();
    // router.push happens inside StripePaymentForm
  }, [clearCart]);

  // ── Loading ──
  if (isLoadingCart) {
    return (
      <div
        style={{
          minHeight: 'calc(100vh - 56px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader2
          size={32}
          color="#0FA3B1"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>
    );
  }

  // ── Error ──
  if (pageError) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: '60px auto',
          padding: '0 16px',
          textAlign: 'center',
        }}
      >
        <p style={{ color: '#DC2626', fontSize: 15, marginBottom: 16 }}>{pageError}</p>
        <Link
          href="/my-workshops"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            backgroundColor: '#0FA3B1',
            color: '#ffffff',
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Back to My Workshops
        </Link>
      </div>
    );
  }

  if (!cart || !org) return null;

  const fees = cart.fee_breakdown;
  const totalFees = fees ? fees.total_fee_cents : 0;
  const total = cart.subtotal_cents + totalFees;
  const isFree = total === 0;
  const clientSecret = clientSecretRef.current;

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
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '32px 16px 64px',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 48,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        {/* ── Left column: summary + payment form ── */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <OrderSummarySection cart={cart} orgName={org.name} pricingData={pricingData} />

          <div style={{ marginTop: 32 }}>
            <h2
              style={{
                fontFamily: 'Sora, sans-serif',
                fontWeight: 700,
                fontSize: 17,
                color: '#111827',
                margin: '0 0 16px',
              }}
            >
              {isFree ? 'Complete registration' : 'Payment details'}
            </h2>

            {/* Free path */}
            {isFree && (
              <FreeCheckoutButton organizationId={org.id} onDone={handleFreeSuccess} />
            )}

            {/* Paid path — show Stripe Elements once client_secret is ready */}
            {!isFree && isInitiatingCheckout && (
              <div
                style={{
                  padding: '32px 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  color: '#6B7280',
                  fontSize: 14,
                }}
              >
                <Loader2
                  size={20}
                  color="#0FA3B1"
                  style={{ animation: 'spin 1s linear infinite' }}
                />
                Preparing payment…
              </div>
            )}

            {!isFree && !isInitiatingCheckout && stripePromise && clientSecret && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: stripeAppearance,
                }}
              >
                <StripePaymentForm
                  total={total}
                  orderNumber={checkoutResult?.order_number ?? ''}
                  onSuccess={handlePaidSuccess}
                />
              </Elements>
            )}
          </div>
        </div>

        {/* ── Right column: sticky order card (desktop) ── */}
        <div
          style={{
            width: 320,
            flexShrink: 0,
            position: 'sticky',
            top: 72,
            alignSelf: 'flex-start',
          }}
          className="hidden md:block"
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 16,
              border: '1px solid #E5E7EB',
              padding: 20,
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            }}
          >
            <p
              style={{
                fontFamily: 'Sora, sans-serif',
                fontWeight: 700,
                fontSize: 15,
                color: '#111827',
                margin: '0 0 14px',
              }}
            >
              Order summary
            </p>
            {cart.items.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 14,
                  color: '#4B5563',
                  marginBottom: 8,
                  gap: 8,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  {item.workshop_title ?? item.session_title ?? 'Item'}
                </span>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {item.unit_price_cents === 0 ? 'Free' : formatCents(item.unit_price_cents)}
                </span>
              </div>
            ))}
            <div
              style={{
                borderTop: '1px solid #E5E7EB',
                paddingTop: 12,
                marginTop: 8,
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: 15,
                color: '#111827',
              }}
            >
              <span>Total due today</span>
              <span>{isFree ? 'Free' : formatCents(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

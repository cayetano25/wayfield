'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Lock,
  Loader2,
  Tag,
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import {
  getCart,
  checkoutCart,
  type Cart,
  type CartCouponData,
  type CheckoutResult,
} from '@/lib/api/cart';
import { apiGet } from '@/lib/api/client';
import { useCart } from '@/contexts/CartContext';
import { formatCents } from '@/lib/utils/currency';
import { CouponInput } from '@/components/checkout/CouponInput';

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

type CheckoutStage = 'summary' | 'initiating' | 'payment_form';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CART_ORG_KEY = 'wayfield_cart_org';

function getPersistedCartOrg(): { id: number; slug: string } | null {
  try {
    const raw = localStorage.getItem(CART_ORG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { id: number; slug: string };
  } catch {
    return null;
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Order Summary ────────────────────────────────────────────────────────────

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
  const total = cart.discounted_total_cents + totalFees;

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
              {item.is_tier_price && item.applied_tier_label && (
                <p style={{ fontSize: 13, color: '#0FA3B1', margin: '4px 0 0', fontWeight: 500 }}>
                  {item.applied_tier_label} price
                </p>
              )}
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
          {cart.discount_cents > 0 && cart.coupon && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#16A34A',
                fontWeight: 500,
                marginBottom: 8,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tag size={12} />
                {cart.coupon.code}
              </span>
              <span>— {formatCents(cart.discount_cents)}</span>
            </div>
          )}
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

      {/* Refund policy */}
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

// ─── Stripe confirm form ───────────────────────────────────────────────────────

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
      setErrorMessage(error.message ?? 'Payment failed. Please try again.');
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      onSuccess();
      router.push(`/orders/${orderNumber}?status=success`);
    } else {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
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
          <>Pay {formatCents(total)}</>
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

// ─── Main checkout page ───────────────────────────────────────────────────────

export default function CheckoutPage() {
  const params = useParams<{ organizationSlug: string }>();
  const organizationSlug = params.organizationSlug;
  const router = useRouter();
  const cartContext = useCart();
  const { clearCart } = cartContext;

  const [cart, setCart] = useState<Cart | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [pricingData, setPricingData] = useState<WorkshopPricing | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null);
  const [checkoutStage, setCheckoutStage] = useState<CheckoutStage>('summary');
  const [isLoadingCart, setIsLoadingCart] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  // client_secret lives only in React state — never persisted to storage
  const clientSecretRef = useRef<string | null>(null);

  // Load cart and org on mount.
  // The cart endpoint returns organization_name/slug, so we resolve org info from the cart
  // rather than a separate by-slug lookup (no such public endpoint exists).
  useEffect(() => {
    async function load() {
      setIsLoadingCart(true);
      try {
        // Resolve org ID. Priority:
        //   1. CartContext (if already loaded — unlikely on first render due to async race)
        //   2. localStorage (synchronously available; written when item is added to cart)
        //   3. /me/organizations API (fallback for org members)
        let orgId: number | null = null;

        const ctxOrgId = cartContext.cart?.organization_id ?? null;
        const ctxOrgSlug = cartContext.cart?.organization_slug ?? null;
        if (ctxOrgSlug === organizationSlug && ctxOrgId != null) {
          orgId = ctxOrgId;
        }

        if (orgId == null) {
          const persisted = getPersistedCartOrg();
          if (persisted?.slug === organizationSlug) {
            orgId = persisted.id;
          }
        }

        if (orgId == null) {
          try {
            const orgs = await apiGet<Array<{ id: number; slug: string; name: string }>>('/me/organizations');
            const match = orgs.find((o) => o.slug === organizationSlug);
            if (match) orgId = match.id;
          } catch {
            // ignore — participant won't have org membership
          }
        }

        if (orgId == null) {
          setPageError('Could not load your cart. Please try again.');
          return;
        }

        const cartData = await getCart(orgId);
        setCart(cartData);

        if (cartData.organization_name && cartData.organization_slug) {
          setOrg({
            id: cartData.organization_id,
            name: cartData.organization_name,
            slug: cartData.organization_slug,
          });
        } else {
          setOrg({ id: cartData.organization_id, name: 'Workshop', slug: organizationSlug });
        }

        if (cartData.items.length === 0) {
          router.replace('/my-workshops');
          return;
        }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationSlug]);

  // Coupon applied — optimistic cart update; if payment form was open, reset it
  const handleCouponApplied = useCallback(
    (coupon: CartCouponData) => {
      setCart((prev) =>
        prev
          ? {
              ...prev,
              discount_cents: coupon.discount_cents,
              discounted_total_cents: coupon.discounted_total_cents,
              coupon,
            }
          : null,
      );
      if (checkoutStage === 'payment_form') {
        setCheckoutResult(null);
        setStripePromise(null);
        clientSecretRef.current = null;
        setCheckoutStage('summary');
      }
    },
    [checkoutStage],
  );

  // Coupon removed — optimistic cart reset; if payment form was open, reset it
  const handleCouponRemoved = useCallback(() => {
    setCart((prev) =>
      prev
        ? {
            ...prev,
            discount_cents: 0,
            discounted_total_cents: prev.subtotal_cents,
            coupon: null,
          }
        : null,
    );
    if (checkoutStage === 'payment_form') {
      setCheckoutResult(null);
      setStripePromise(null);
      clientSecretRef.current = null;
      setCheckoutStage('summary');
    }
  }, [checkoutStage]);

  // Initiate checkout — called on "Pay" button click
  const initiatePayment = useCallback(async () => {
    if (!org || !cart) return;
    setCheckoutStage('initiating');
    setPageError(null);
    try {
      const result = await checkoutCart(org.id);
      setCheckoutResult(result);

      if (!result.requires_payment) {
        clearCart();
        router.push(`/orders/${result.order_number}?status=success`);
        return;
      }

      clientSecretRef.current = result.client_secret;
      setStripePromise(loadStripe(result.stripe_publishable_key));
      setCheckoutStage('payment_form');
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Could not initiate checkout. Please try again.';
      setPageError(msg);
      setCheckoutStage('summary');
    }
  }, [cart, clearCart, org, router]);

  const handlePaidSuccess = useCallback(() => {
    clearCart();
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
        <Loader2 size={32} color="#0FA3B1" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  // ── Error ──
  if (pageError && !cart) {
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
  const total = cart.discounted_total_cents + totalFees;
  const isFree = cart.discounted_total_cents === 0;
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
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px 64px' }}>
      <div
        style={{
          display: 'flex',
          gap: 48,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        {/* ── Left column ── */}
        <div style={{ flex: 1, minWidth: 300 }}>
          <OrderSummarySection cart={cart} orgName={org.name} pricingData={pricingData} />

          {/* Coupon input — always shown above the payment section */}
          <CouponInput
            organizationId={org.id}
            appliedCoupon={cart.coupon ?? null}
            onCouponApplied={handleCouponApplied}
            onCouponRemoved={handleCouponRemoved}
          />

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
              {isFree ? 'Complete registration' : 'Payment'}
            </h2>

            {/* Inline error from checkout initiation */}
            {pageError && (
              <p
                role="alert"
                style={{
                  fontSize: 14,
                  color: '#DC2626',
                  marginBottom: 16,
                  padding: '10px 14px',
                  backgroundColor: '#FEF2F2',
                  borderRadius: 8,
                  border: '1px solid #FECACA',
                }}
              >
                {pageError}
              </p>
            )}

            {/* Free path — coupon makes everything free */}
            {isFree && (
              <>
                <div
                  style={{
                    borderRadius: 16,
                    border: '2px solid #BBF7D0',
                    backgroundColor: '#F0FDF4',
                    padding: 20,
                    marginBottom: 20,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <CheckCircle size={20} color="#16A34A" />
                    <p
                      style={{
                        fontWeight: 600,
                        color: '#14532D',
                        margin: 0,
                        fontSize: 15,
                      }}
                    >
                      Your coupon covers the full cost!
                    </p>
                  </div>
                  <p style={{ fontSize: 14, color: '#166534', margin: '6px 0 0 32px' }}>
                    No payment is required. Click below to complete your registration.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={initiatePayment}
                  disabled={checkoutStage === 'initiating'}
                  aria-busy={checkoutStage === 'initiating'}
                  style={{
                    width: '100%',
                    padding: '16px 0',
                    borderRadius: 12,
                    backgroundColor: checkoutStage === 'initiating' ? '#D1D5DB' : '#0FA3B1',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 16,
                    border: 'none',
                    cursor: checkoutStage === 'initiating' ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    transition: 'background-color 150ms',
                  }}
                >
                  {checkoutStage === 'initiating' ? (
                    <>
                      <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                      Completing…
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      Complete Registration — Free
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
              </>
            )}

            {/* Paid path — summary stage: show Pay button */}
            {!isFree && checkoutStage === 'summary' && (
              <button
                type="button"
                onClick={initiatePayment}
                style={{
                  width: '100%',
                  marginTop: 8,
                  padding: '16px 0',
                  borderRadius: 12,
                  backgroundColor: '#0FA3B1',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 16,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  transition: 'background-color 150ms',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0c8a96';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0FA3B1';
                }}
              >
                Pay {formatCents(total)}
              </button>
            )}

            {/* Paid path — initiating: spinner */}
            {!isFree && checkoutStage === 'initiating' && (
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
                <Loader2 size={20} color="#0FA3B1" style={{ animation: 'spin 1s linear infinite' }} />
                Preparing payment…
              </div>
            )}

            {/* Paid path — payment form: Stripe Elements */}
            {!isFree &&
              checkoutStage === 'payment_form' &&
              stripePromise &&
              clientSecret && (
                <>
                  <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>
                    Enter your payment details below.
                  </p>
                  <Elements
                    stripe={stripePromise}
                    options={{ clientSecret, appearance: stripeAppearance }}
                  >
                    <StripePaymentForm
                      total={total}
                      orderNumber={checkoutResult?.order_number ?? ''}
                      onSuccess={handlePaidSuccess}
                    />
                  </Elements>
                </>
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
            {cart.discount_cents > 0 && cart.coupon && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 13,
                  color: '#16A34A',
                  fontWeight: 500,
                  marginBottom: 8,
                  gap: 8,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Tag size={12} />
                  {cart.coupon.code}
                </span>
                <span>— {formatCents(cart.discount_cents)}</span>
              </div>
            )}
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

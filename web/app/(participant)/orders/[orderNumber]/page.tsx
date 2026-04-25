'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle,
  Calendar,
  CreditCard,
  ArrowRight,
  Loader2,
  AlertCircle,
  ShoppingBag,
  Clock,
} from 'lucide-react';
import { getOrder, type OrderSummary } from '@/lib/api/cart';
import { formatCents } from '@/lib/utils/currency';

function SuccessAnimation() {
  return (
    <div
      style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        backgroundColor: '#DCFCE7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
        animation: 'bounceOnce 600ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}
    >
      <CheckCircle size={40} color="#16A34A" strokeWidth={2} />
    </div>
  );
}

function OrderItemRow({ item }: { item: OrderSummary['items'][number] }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid #F3F4F6',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: '#F0FDFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <ShoppingBag size={16} color="#0FA3B1" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: '#111827',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.workshop_title ?? item.session_title ?? 'Item'}
        </p>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
          {item.item_type === 'addon_session' ? 'Add-on session' : 'Workshop registration'}
        </p>
        {item.is_deposit && item.balance_due_date && (
          <p
            style={{
              fontSize: 11,
              color: '#92400E',
              marginTop: 4,
              backgroundColor: '#FFFBEB',
              borderRadius: 4,
              padding: '2px 6px',
              display: 'inline-block',
            }}
          >
            Deposit paid · Balance due{' '}
            {new Date(item.balance_due_date).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
      <span style={{ fontWeight: 700, fontSize: 14, color: '#111827', whiteSpace: 'nowrap' }}>
        {item.line_total_cents === 0 ? 'Free' : formatCents(item.line_total_cents)}
      </span>
    </div>
  );
}

function WhatsNextCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '14px 0',
        borderBottom: '1px solid #F3F4F6',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          backgroundColor: '#F0FDFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        {icon}
      </div>
      <div>
        <p style={{ fontWeight: 600, fontSize: 14, color: '#111827', margin: 0 }}>{title}</p>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '3px 0 0', lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = params.orderNumber as string;

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOrder() {
      try {
        const data = await getOrder(orderNumber);
        if (!cancelled) setOrder(data);
      } catch {
        if (!cancelled) setError('Order not found. Please check your email for confirmation.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadOrder();
    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader2 size={32} color="#0FA3B1" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: '64px auto',
          padding: '0 16px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: '#FEF2F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
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
            margin: '0 0 8px',
          }}
        >
          Order not found
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 24px', lineHeight: 1.6 }}>
          {error ?? 'We could not load your order details.'}
        </p>
        <Link
          href="/my-workshops"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            borderRadius: 10,
            backgroundColor: '#0FA3B1',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Go to My Workshops
        </Link>
      </div>
    );
  }

  const hasDeposit = order.is_deposit_order && order.balance_due_date != null;
  const hasVirtual = order.items.some((i) => i.item_type === 'addon_session');

  return (
    <>
      <style>{`
        @keyframes bounceOnce {
          0%   { transform: scale(0.5); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          80%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div
        style={{
          maxWidth: 520,
          margin: '0 auto',
          padding: '48px 16px 80px',
        }}
      >
        {/* Success hero */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <SuccessAnimation />
          <h1
            style={{
              fontFamily: 'Sora, sans-serif',
              fontWeight: 700,
              fontSize: 26,
              color: '#111827',
              margin: '0 0 8px',
            }}
          >
            You&apos;re registered!
          </h1>
          <p style={{ fontSize: 15, color: '#6B7280', margin: '0 0 6px', lineHeight: 1.6 }}>
            Order <strong style={{ color: '#111827' }}>{order.order_number}</strong> is confirmed.
          </p>
          <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
            A confirmation email is on its way to you.
          </p>
        </div>

        {/* Order summary card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: '20px 20px 4px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontFamily: 'Sora, sans-serif',
              fontWeight: 700,
              fontSize: 11,
              color: '#9CA3AF',
              margin: '0 0 4px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Order Summary
          </h2>

          {order.items.map((item) => (
            <OrderItemRow key={item.id} item={item} />
          ))}

          {/* Totals */}
          <div style={{ padding: '12px 0 8px' }}>
            {order.subtotal_cents !== order.total_cents && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: '#6B7280',
                  marginBottom: 6,
                }}
              >
                <span>Subtotal</span>
                <span>{formatCents(order.subtotal_cents)}</span>
              </div>
            )}
            {(order.wayfield_fee_cents > 0 || order.stripe_fee_cents > 0) && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: '#6B7280',
                  marginBottom: 6,
                }}
              >
                <span>Processing fee</span>
                <span>{formatCents(order.wayfield_fee_cents + order.stripe_fee_cents)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 15,
                fontWeight: 700,
                color: '#111827',
                paddingTop: 10,
                borderTop: '1px solid #E5E7EB',
              }}
            >
              <span>{hasDeposit ? 'Deposit paid today' : 'Total paid'}</span>
              <span>{order.total_cents === 0 ? 'Free' : formatCents(order.total_cents)}</span>
            </div>
            {hasDeposit && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: '#92400E',
                  marginTop: 6,
                  backgroundColor: '#FFFBEB',
                  borderRadius: 6,
                  padding: '6px 8px',
                }}
              >
                <span>Balance due</span>
                <span>
                  {new Date(order.balance_due_date!).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Payment method badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#F9FAFB',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 24,
            fontSize: 12,
            color: '#6B7280',
          }}
        >
          <CreditCard size={14} color="#9CA3AF" />
          <span>
            {order.payment_method === 'stripe'
              ? 'Paid by card'
              : order.payment_method === 'free'
                ? 'No payment required'
                : order.payment_method}
          </span>
          <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>
            {order.completed_at
              ? new Date(order.completed_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : new Date(order.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
          </span>
        </div>

        {/* What's next card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: '20px 20px 4px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            marginBottom: 32,
          }}
        >
          <h2
            style={{
              fontFamily: 'Sora, sans-serif',
              fontWeight: 700,
              fontSize: 11,
              color: '#9CA3AF',
              margin: '0 0 4px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            What&apos;s next
          </h2>

          <WhatsNextCard
            icon={<Calendar size={16} color="#0FA3B1" />}
            title="Check your schedule"
            description="Your sessions are now confirmed. Visit My Workshops to view your schedule and select any optional sessions."
          />

          {hasDeposit && (
            <WhatsNextCard
              icon={<Clock size={16} color="#D97706" />}
              title="Balance payment reminder"
              description={`Your remaining balance is due by ${new Date(order.balance_due_date!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. You'll receive a reminder email before the deadline.`}
            />
          )}

          {hasVirtual && (
            <WhatsNextCard
              icon={<CheckCircle size={16} color="#0FA3B1" />}
              title="Virtual session access"
              description="Join links for online sessions become available when you open each session in My Workshops."
            />
          )}

          <WhatsNextCard
            icon={<ShoppingBag size={16} color="#0FA3B1" />}
            title="Confirmation email"
            description="We've sent a receipt and registration details to your email address."
          />
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link
            href="/my-workshops"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '14px 0',
              borderRadius: 12,
              backgroundColor: '#0FA3B1',
              color: '#ffffff',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 700,
              fontSize: 15,
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            View My Workshops
            <ArrowRight size={16} />
          </Link>

          <Link
            href="/discover"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '13px 0',
              borderRadius: 12,
              backgroundColor: '#F9FAFB',
              color: '#374151',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
              border: '1px solid #E5E7EB',
              textAlign: 'center',
            }}
          >
            Browse More Workshops
          </Link>
        </div>
      </div>
    </>
  );
}

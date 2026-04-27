'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Loader2, ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { formatCents } from '@/lib/utils/currency';
import type { CartItem } from '@/lib/api/cart';

function CartItemRow({
  item,
  onRemove,
  removing,
}: {
  item: CartItem;
  onRemove: (id: number) => void;
  removing: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  const handleRemoveClick = () => {
    if (confirming) {
      onRemove(item.id);
      setConfirming(false);
    } else {
      setConfirming(true);
    }
  };

  return (
    <div
      style={{
        padding: '14px 0',
        borderBottom: '1px solid #F3F4F6',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        opacity: removing ? 0.5 : 1,
        transition: 'opacity 200ms',
      }}
    >
      {/* Icon */}
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

      {/* Details */}
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
        {item.is_deposit && item.balance_amount_cents != null && (
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
            Deposit · Balance {formatCents(item.balance_amount_cents)}
            {item.balance_due_date
              ? ` due ${new Date(item.balance_due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
              : ''}
          </p>
        )}
      </div>

      {/* Price + remove */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
          {item.unit_price_cents === 0 ? 'Free' : formatCents(item.unit_price_cents)}
        </span>
        <button
          onClick={handleRemoveClick}
          disabled={removing}
          aria-label={confirming ? 'Confirm remove item' : 'Remove item'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 4,
            color: confirming ? '#EF4444' : '#9CA3AF',
            fontSize: 12,
            fontWeight: confirming ? 600 : 400,
            transition: 'color 150ms',
          }}
        >
          <Trash2 size={13} />
          {confirming ? 'Confirm remove' : 'Remove'}
        </button>
        {confirming && (
          <button
            onClick={() => setConfirming(false)}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#6B7280',
              fontSize: 11,
              padding: '2px 4px',
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export function CartDrawer() {
  const { cart, isLoading, isOpen, organizationSlug, closeCart, removeItem } = useCart();
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [feesOpen, setFeesOpen] = useState(false);
  const router = useRouter();

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, closeCart]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleRemove = useCallback(
    async (itemId: number) => {
      if (!cart) return;
      setRemovingId(itemId);
      try {
        await removeItem(cart.organization_id, itemId);
      } finally {
        setRemovingId(null);
      }
    },
    [cart, removeItem],
  );

  const handleCheckout = () => {
    closeCart();
    if (organizationSlug) {
      router.push(`/checkout/${organizationSlug}`);
    }
  };

  if (!isOpen) return null;

  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal_cents ?? 0;
  const fees = cart?.fee_breakdown;
  const totalFees = fees ? fees.total_fee_cents : 0;
  const total = subtotal + totalFees;
  const isEmpty = items.length === 0;
  const canCheckout = !isEmpty && !!organizationSlug;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeCart}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.35)',
          zIndex: 49,
          animation: 'fadeIn 150ms ease',
        }}
        aria-hidden="true"
      />

      {/* Drawer — right side on desktop, bottom on mobile */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 'min(420px, 100vw)',
          backgroundColor: '#ffffff',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
          animation: 'slideInRight 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #E5E7EB',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={18} color="#0FA3B1" />
            <h2
              style={{
                fontFamily: 'Sora, sans-serif',
                fontWeight: 700,
                fontSize: 16,
                margin: 0,
                color: '#111827',
              }}
            >
              Your Order
            </h2>
            {items.length > 0 && (
              <span
                style={{
                  backgroundColor: '#F0FDFF',
                  color: '#0FA3B1',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 9999,
                }}
              >
                {items.length}
              </span>
            )}
          </div>
          <button
            onClick={closeCart}
            aria-label="Close cart"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#6B7280',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px' }}>
          {isLoading && items.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <Loader2 size={24} color="#0FA3B1" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : isEmpty ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <ShoppingBag size={40} color="#D1D5DB" style={{ marginBottom: 12 }} />
              <p style={{ color: '#9CA3AF', fontSize: 14, margin: '0 0 16px' }}>
                Your cart is empty
              </p>
              <Link
                href="/discover"
                onClick={closeCart}
                style={{
                  display: 'inline-block',
                  padding: '8px 20px',
                  borderRadius: 8,
                  backgroundColor: '#F0FDFF',
                  color: '#0FA3B1',
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: 'none',
                }}
              >
                Browse workshops
              </Link>
            </div>
          ) : (
            items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                onRemove={handleRemove}
                removing={removingId === item.id}
              />
            ))
          )}
        </div>

        {/* Footer — sticky */}
        {!isEmpty && (
          <div
            style={{
              borderTop: '1px solid #E5E7EB',
              padding: '16px 20px',
              flexShrink: 0,
              backgroundColor: '#ffffff',
            }}
          >
            {/* Subtotal */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 14,
                color: '#374151',
                marginBottom: 8,
              }}
            >
              <span>Subtotal</span>
              <span style={{ fontWeight: 600 }}>
                {subtotal === 0 ? 'Free' : formatCents(subtotal)}
              </span>
            </div>

            {/* Fee breakdown toggle */}
            {fees && subtotal > 0 && (
              <>
                <button
                  onClick={() => setFeesOpen((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: '#6B7280',
                    fontSize: 12,
                    padding: '2px 0 8px',
                    width: '100%',
                    textAlign: 'left',
                  }}
                  aria-expanded={feesOpen}
                >
                  {feesOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {feesOpen ? 'Hide' : 'View'} fee breakdown
                </button>

                {feesOpen && (
                  <div
                    style={{
                      backgroundColor: '#F9FAFB',
                      borderRadius: 10,
                      padding: '10px 12px',
                      marginBottom: 12,
                      fontSize: 12,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: '#6B7280',
                        marginBottom: 6,
                      }}
                    >
                      <span>Processing fee</span>
                      <span>{formatCents(fees.total_fee_cents)}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 600,
                        color: '#111827',
                        paddingTop: 8,
                        borderTop: '1px solid #E5E7EB',
                      }}
                    >
                      <span>Total due today</span>
                      <span>{formatCents(total)}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* CTA */}
            <button
              onClick={handleCheckout}
              disabled={!canCheckout}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 12,
                backgroundColor: canCheckout ? '#0FA3B1' : '#D1D5DB',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 15,
                border: 'none',
                cursor: canCheckout ? 'pointer' : 'not-allowed',
                transition: 'background-color 150ms',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}
              onMouseEnter={(e) => {
                if (canCheckout)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0c8a96';
              }}
              onMouseLeave={(e) => {
                if (canCheckout)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0FA3B1';
              }}
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}

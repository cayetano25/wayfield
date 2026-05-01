'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Check, Loader2, X } from 'lucide-react';
import { useOptionalCart } from '@/contexts/CartContext';
import { ApiError, apiDelete } from '@/lib/api/client';
import type { WorkshopPricingDisplay } from '@/lib/api/public';

interface AddToCartButtonProps {
  workshopId: number;
  orgId: number;
  orgSlug: string;
  publicSlug: string;
  pricing?: WorkshopPricingDisplay | null;
  fullWidth?: boolean;
  isRegistered?: boolean;
  workshopStartDate?: string;
}

export function AddToCartButton({
  workshopId,
  orgId,
  orgSlug,
  publicSlug,
  pricing,
  fullWidth = false,
  isRegistered = false,
  workshopStartDate,
}: AddToCartButtonProps) {
  const cart = useOptionalCart();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRegistered, setAutoRegistered] = useState(false);
  const [unregistered, setUnregistered] = useState(false);
  const [unregistering, setUnregistering] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const inCart = cart?.cart?.items.some((item) => item.workshop_id === workshopId) ?? false;
  const isFree = !pricing || pricing.current_price_cents === 0;

  const priceLabel = isFree
    ? 'Free'
    : `$${(pricing!.current_price_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  // Cancellation is allowed up until the workshop start date.
  const canCancel = workshopStartDate
    ? new Date(workshopStartDate) > new Date()
    : false;

  const handleClick = async () => {
    if (autoRegistered) return;

    if (inCart) {
      cart?.openCart();
      return;
    }

    if (!cart) return;

    setLoading(true);
    setError(null);

    try {
      const updatedCart = await cart.addWorkshop(orgId, workshopId, orgSlug);
      const workshopInCart = updatedCart.items.some((item) => item.workshop_id === workshopId);
      if (workshopInCart) {
        cart.openCart();
      } else {
        setAutoRegistered(true);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push(`/login?return=/w/${publicSlug}`);
        return;
      }
      if (err instanceof ApiError && err.status === 409 && err.code === 'DUPLICATE_WORKSHOP') {
        await cart.refreshCart(orgId, orgSlug);
        cart.openCart();
        return;
      }
      if (err instanceof ApiError && err.status === 409 && err.code === 'CART_ORG_MISMATCH') {
        setError('You have an active cart for a different organization. Complete or clear that order first.');
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Could not add to cart. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnregister = async () => {
    setUnregistering(true);
    setError(null);
    try {
      await apiDelete(`/workshops/${workshopId}/registration`);
      setUnregistered(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel registration. Please try again.');
    } finally {
      setUnregistering(false);
    }
  };

  // Show registered state — either from server prop or client-side action.
  // If the user unregistered this session, show the register button again.
  if ((isRegistered || autoRegistered) && !unregistered) {
    return (
      <div className={fullWidth ? 'w-full' : undefined}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            width: fullWidth ? '100%' : undefined,
            minHeight: 48,
            padding: '12px 28px',
            borderRadius: 12,
            backgroundColor: '#ECFDF5',
            color: '#065F46',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}
        >
          <Check size={17} />
          You&apos;re Registered
        </div>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: 6, textAlign: 'center' }}>
          Check your email for confirmation details.
        </p>
        {canCancel && isFree && (
          confirmingCancel ? (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 13, color: '#374151', textAlign: 'center', marginBottom: 8, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                Are you sure you want to cancel your registration?
              </p>
              <div style={{ display: 'flex', gap: 8, width: fullWidth ? '100%' : undefined }}>
                <button
                  type="button"
                  onClick={handleUnregister}
                  disabled={unregistering}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: 'none',
                    backgroundColor: '#DC2626',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    cursor: unregistering ? 'not-allowed' : 'pointer',
                    opacity: unregistering ? 0.6 : 1,
                  }}
                >
                  {unregistering
                    ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Cancelling…</>
                    : 'Yes, cancel'
                  }
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  disabled={unregistering}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid #D1D5DB',
                    backgroundColor: 'transparent',
                    color: '#374151',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    cursor: 'pointer',
                  }}
                >
                  Keep registration
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingCancel(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: fullWidth ? '100%' : undefined,
                marginTop: 10,
                padding: '8px 16px',
                borderRadius: 10,
                border: '1px solid #FCA5A5',
                backgroundColor: 'transparent',
                color: '#DC2626',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                cursor: 'pointer',
                transition: 'background-color 150ms',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FEF2F2';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              <X size={13} /> Cancel Registration
            </button>
          )
        )}
        {error && (
          <p style={{ fontSize: 13, color: '#DC2626', marginTop: 6, textAlign: 'center' }}>{error}</p>
        )}
      </div>
    );
  }

  const label = inCart
    ? 'View Cart'
    : isFree
      ? 'Register — Free'
      : `Add to Cart — ${priceLabel}`;

  return (
    <div className={fullWidth ? 'w-full' : undefined}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: fullWidth ? '100%' : undefined,
          minHeight: 48,
          padding: '12px 28px',
          borderRadius: 12,
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 15,
          fontWeight: 700,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          transition: 'background-color 150ms, transform 80ms',
          backgroundColor: inCart ? '#ECFDF5' : '#0FA3B1',
          color: inCart ? '#065F46' : '#ffffff',
          opacity: loading ? 0.75 : 1,
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = inCart ? '#D1FAE5' : '#0c8a96';
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = inCart ? '#ECFDF5' : '#0FA3B1';
        }}
        onMouseDown={(e) => {
          if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)';
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
        }}
      >
        {loading ? (
          <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />
        ) : inCart ? (
          <Check size={17} />
        ) : (
          <ShoppingBag size={17} />
        )}
        {loading ? 'Adding…' : label}
      </button>
      {error && (
        <p style={{ fontSize: 13, color: '#DC2626', marginTop: 6 }}>{error}</p>
      )}
    </div>
  );
}

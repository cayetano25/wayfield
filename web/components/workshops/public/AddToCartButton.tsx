'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Check, Loader2 } from 'lucide-react';
import { useOptionalCart } from '@/contexts/CartContext';
import { ApiError } from '@/lib/api/client';
import type { WorkshopPricingDisplay } from '@/lib/api/public';

interface AddToCartButtonProps {
  workshopId: number;
  orgId: number;
  orgSlug: string;
  publicSlug: string;
  pricing?: WorkshopPricingDisplay | null;
  fullWidth?: boolean;
}

export function AddToCartButton({
  workshopId,
  orgId,
  orgSlug,
  publicSlug,
  pricing,
  fullWidth = false,
}: AddToCartButtonProps) {
  const cart = useOptionalCart();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inCart = cart?.cart?.items.some((item) => item.workshop_id === workshopId) ?? false;
  const isFree = !pricing || pricing.current_price_cents === 0;

  const priceLabel = isFree
    ? 'Free'
    : `$${(pricing!.current_price_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const handleClick = async () => {
    if (inCart) {
      cart?.openCart();
      return;
    }

    if (!cart) return;

    setLoading(true);
    setError(null);

    try {
      await cart.addWorkshop(orgId, workshopId, orgSlug);
      cart.openCart();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push(`/login?return=/w/${publicSlug}`);
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        // Item already in cart (e.g. added before a page refresh) — sync state then show cart
        await cart.refreshCart(orgId, orgSlug);
        cart.openCart();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Could not add to cart. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

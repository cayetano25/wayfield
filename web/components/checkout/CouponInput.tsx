'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, Tag, X } from 'lucide-react';
import { applyCoupon, removeCoupon, type CartCouponData } from '@/lib/api/cart';
import { ApiError } from '@/lib/api/client';

interface CouponInputProps {
  organizationId: number;
  appliedCoupon: CartCouponData | null;
  onCouponApplied: (coupon: CartCouponData) => void;
  onCouponRemoved: () => void;
  cartHasDepositItem?: boolean;
}

export function CouponInput({
  organizationId,
  appliedCoupon,
  onCouponApplied,
  onCouponRemoved,
  cartHasDepositItem = false,
}: CouponInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const coupon = await applyCoupon(organizationId, trimmed);
      onCouponApplied(coupon);
      setCode('');
      setIsExpanded(false);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'Unable to apply coupon. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeCoupon(organizationId);
      onCouponRemoved();
    } catch {
      // Removal failures are silent — the coupon UI resets optimistically
    }
  };

  // STATE 3 — coupon applied
  if (appliedCoupon) {
    return (
      <div
        style={{
          marginTop: 16,
          borderTop: '1px solid #F3F4F6',
          paddingTop: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: '#DCFCE7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Tag size={13} color="#15803D" />
            </div>
            <div>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#166534',
                  margin: 0,
                  fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '0.05em',
                }}
              >
                {appliedCoupon.code}
              </p>
              <p style={{ fontSize: 12, color: '#16A34A', margin: 0 }}>{appliedCoupon.message}</p>
            </div>
          </div>
          <button
            onClick={handleRemove}
            aria-label="Remove coupon code"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#9CA3AF',
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 8,
              transition: 'color 150ms, background-color 150ms',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#EF4444';
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FEF2F2';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF';
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            <X size={12} />
            Remove
          </button>
        </div>
      </div>
    );
  }

  // STATE 2 — input expanded
  if (isExpanded) {
    return (
      <div
        style={{
          marginTop: 16,
          borderTop: '1px solid #F3F4F6',
          paddingTop: 16,
        }}
      >
        <label
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 600,
            color: '#374151',
            marginBottom: 8,
          }}
        >
          Coupon Code
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            placeholder="SUMMER20"
            maxLength={50}
            disabled={isLoading}
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? 'coupon-error' : undefined}
            style={{
              flex: 1,
              border: `1px solid ${error ? '#F87171' : '#D1D5DB'}`,
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 14,
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              outline: 'none',
              transition: 'border-color 150ms',
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor = error
                ? '#F87171'
                : '#0FA3B1';
              (e.currentTarget as HTMLInputElement).style.boxShadow = error
                ? '0 0 0 2px rgba(248,113,113,0.2)'
                : '0 0 0 2px rgba(15,163,177,0.15)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor = error
                ? '#F87171'
                : '#D1D5DB';
              (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
            }}
          />
          <button
            onClick={handleApply}
            disabled={isLoading || !code.trim()}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              backgroundColor:
                isLoading || !code.trim() ? '#D1D5DB' : '#111827',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              cursor: isLoading || !code.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              transition: 'background-color 150ms',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}
            onMouseEnter={(e) => {
              if (!isLoading && code.trim()) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#374151';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && code.trim()) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#111827';
              }
            }}
          >
            {isLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Apply'}
          </button>
        </div>

        {error && (
          <p
            id="coupon-error"
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: '#DC2626',
              marginTop: 8,
            }}
          >
            <AlertCircle size={13} />
            {error}
          </p>
        )}
        {error?.toLowerCase().includes('minimum order') && cartHasDepositItem && (
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
            Note: the minimum is checked against the full workshop price, not the deposit amount.
          </p>
        )}
      </div>
    );
  }

  // STATE 1 — collapsed
  return (
    <div
      style={{
        marginTop: 16,
        borderTop: '1px solid #F3F4F6',
        paddingTop: 16,
      }}
    >
      <button
        onClick={() => setIsExpanded(true)}
        aria-expanded={false}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: '#0FA3B1',
          fontSize: 14,
          fontWeight: 500,
          padding: 0,
          transition: 'color 150ms',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = '#0c8a96';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = '#0FA3B1';
        }}
      >
        <Tag size={14} />
        Have a coupon code?
      </button>
    </div>
  );
}

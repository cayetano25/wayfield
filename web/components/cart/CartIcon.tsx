'use client';

import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

export function CartIcon() {
  const { itemCount, toggleCart } = useCart();

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={toggleCart}
        aria-label={
          itemCount > 0
            ? `Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`
            : 'Cart, empty'
        }
        aria-haspopup="dialog"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: 8,
          border: 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          transition: 'background-color 150ms',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F9FAFB';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
        }}
      >
        <ShoppingBag size={20} color="#374151" strokeWidth={1.75} />

        {itemCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 18,
              height: 18,
              borderRadius: 9999,
              backgroundColor: '#0FA3B1',
              color: '#ffffff',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              border: '2px solid #ffffff',
              animation: 'badgePop 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            }}
          >
            {itemCount > 9 ? '9+' : itemCount}
          </span>
        )}
      </button>
    </div>
  );
}

'use client';

import { AlertTriangle } from 'lucide-react';

interface CartOrgMismatchModalProps {
  existingOrgName: string;
  newOrgName: string;
  onKeep: () => void;
  onStartFresh: () => void;
  isLoading?: boolean;
}

export function CartOrgMismatchModal({
  existingOrgName,
  newOrgName,
  onKeep,
  onStartFresh,
  isLoading,
}: CartOrgMismatchModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.40)',
          backdropFilter: 'blur(4px)',
        }}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cart-mismatch-title"
        aria-describedby="cart-mismatch-desc"
        style={{
          position: 'relative',
          backgroundColor: '#ffffff',
          borderRadius: 16,
          padding: '24px',
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 24px 64px rgba(46,46,46,0.18)',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: '#FFFBEB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <AlertTriangle size={22} color="#D97706" />
        </div>

        <h2
          id="cart-mismatch-title"
          style={{
            fontFamily: 'Sora, sans-serif',
            fontWeight: 700,
            fontSize: 17,
            color: '#111827',
            margin: '0 0 10px',
          }}
        >
          Start a new order?
        </h2>
        <p
          id="cart-mismatch-desc"
          style={{
            fontSize: 14,
            color: '#4B5563',
            margin: '0 0 20px',
            lineHeight: 1.55,
          }}
        >
          Your cart contains items from{' '}
          <strong style={{ color: '#111827' }}>{existingOrgName}</strong>. Adding items from{' '}
          <strong style={{ color: '#111827' }}>{newOrgName}</strong> requires a separate checkout.
          Would you like to keep your current cart or start fresh?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onKeep}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 10,
              backgroundColor: '#0FA3B1',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Keep current cart
          </button>
          <button
            onClick={onStartFresh}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 10,
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              fontWeight: 600,
              fontSize: 14,
              border: '1px solid #FECACA',
              cursor: 'pointer',
            }}
          >
            {isLoading ? 'Starting fresh…' : 'Start new cart'}
          </button>
        </div>
      </div>
    </div>
  );
}

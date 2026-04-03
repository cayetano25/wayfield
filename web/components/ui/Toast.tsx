'use client';

import { Toaster } from 'react-hot-toast';

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
          fontSize: '14px',
          borderRadius: '8px',
          boxShadow: '0px 12px 32px rgba(46,46,46,0.12)',
          padding: '12px 16px',
          color: '#2E2E2E',
        },
        success: {
          iconTheme: { primary: '#0FA3B1', secondary: '#ffffff' },
          style: {
            borderLeft: '4px solid #0FA3B1',
          },
        },
        error: {
          iconTheme: { primary: '#E94F37', secondary: '#ffffff' },
          style: {
            borderLeft: '4px solid #E94F37',
          },
        },
      }}
    />
  );
}

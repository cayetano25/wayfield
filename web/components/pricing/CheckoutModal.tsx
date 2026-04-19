'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Elements,
  PaymentElement,
  PaymentRequestButtonElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import type { PaymentRequest, Appearance } from '@stripe/stripe-js'
import { X, Lock, AlertCircle, RotateCcw } from 'lucide-react'
import { stripePromise } from '@/lib/stripe'
import { ApiError } from '@/lib/api/client'
import { createSetupIntent, subscribeToPlan } from '@/lib/api/billing'
import type { BillingCycle } from '@/lib/types/billing'

// ---- Types ----

export interface SelectedPlan {
  code: string
  displayName: string
  interval: BillingCycle
  monthlyCents: number | null
  annualCents: number | null
}

interface CheckoutModalProps {
  selectedPlan: SelectedPlan
  orgId: number
  onSuccess: () => void
  onClose: () => void
}

// ---- Stripe appearance ----

const STRIPE_APPEARANCE: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#0FA3B1',
    colorBackground: '#ffffff',
    colorText: '#2E2E2E',
    borderRadius: '8px',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
  },
}

// ---- Helpers ----

function formatCents(cents: number): string {
  const d = cents / 100
  return d % 1 === 0 ? `$${d}` : `$${d.toFixed(2)}`
}

// ---- Inner form (must be a child of <Elements>) ----

interface CheckoutFormProps {
  selectedPlan: SelectedPlan
  orgId: number
  onSuccess: () => void
  onClose: () => void
  onProcessingChange: (v: boolean) => void
}

function CheckoutForm({ selectedPlan, orgId, onSuccess, onClose, onProcessingChange }: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()

  const [nameOnCard, setNameOnCard] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null)

  const priceInCents =
    selectedPlan.interval === 'annual' ? selectedPlan.annualCents : selectedPlan.monthlyCents

  const monthlyDisplayCents =
    selectedPlan.interval === 'annual' && selectedPlan.annualCents
      ? Math.round(selectedPlan.annualCents / 12)
      : selectedPlan.monthlyCents

  const setProcessing = useCallback(
    (val: boolean) => {
      setIsProcessing(val)
      onProcessingChange(val)
    },
    [onProcessingChange],
  )

  // Wallet pay (Apple Pay / Google Pay)
  useEffect(() => {
    if (!stripe || !priceInCents) return

    const pr = stripe.paymentRequest({
      country: 'US',
      currency: 'usd',
      total: {
        label: `Wayfield ${selectedPlan.displayName}`,
        amount: priceInCents,
      },
      requestPayerName: true,
      requestPayerEmail: true,
    })

    pr.canMakePayment().then((result) => {
      if (result) setPaymentRequest(pr)
    })

    pr.on('paymentmethod', async (ev) => {
      setProcessing(true)
      setError(null)
      try {
        await subscribeToPlan({
          org_id: orgId,
          plan_code: selectedPlan.code,
          interval: selectedPlan.interval,
          payment_method_id: ev.paymentMethod.id,
        })
        ev.complete('success')
        onSuccess()
        onClose()
      } catch (err) {
        ev.complete('fail')
        setError(err instanceof ApiError ? err.message : 'Payment failed. Please try again.')
        setProcessing(false)
      }
    })

    return () => { pr.off('paymentmethod') }
    // stripe reference is stable after mount; re-run only if plan changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripe, priceInCents])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements || isProcessing) return

    setProcessing(true)
    setError(null)

    const result = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    })

    if (result.error) {
      setError(result.error.message ?? 'An error occurred. Please try again.')
      setProcessing(false)
      return
    }

    if (result.setupIntent?.status === 'succeeded') {
      const pm = result.setupIntent.payment_method
      const paymentMethodId = typeof pm === 'string' ? pm : pm?.id
      if (!paymentMethodId) {
        setError('Could not retrieve payment method. Please try again.')
        setProcessing(false)
        return
      }
      try {
        await subscribeToPlan({
          org_id: orgId,
          plan_code: selectedPlan.code,
          interval: selectedPlan.interval,
          payment_method_id: paymentMethodId,
        })
        onSuccess()
        onClose()
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Payment failed. Please try again.'
        setError(msg)
        setProcessing(false)
      }
    } else {
      setError('An unexpected error occurred. Please try again.')
      setProcessing(false)
    }
  }

  const subscribeBtnLabel = isProcessing
    ? 'Processing…'
    : `Subscribe — ${monthlyDisplayCents ? formatCents(monthlyDisplayCents) : '…'}/mo`

  return (
    <form onSubmit={handleSubmit}>
      {/* Price summary */}
      <div
        style={{
          background: '#F9FAFB',
          border: '1px solid #E5E7EB',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 600,
            color: '#2E2E2E',
            marginBottom: '4px',
          }}
        >
          {selectedPlan.displayName} · {monthlyDisplayCents ? formatCents(monthlyDisplayCents) : '…'}/month
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#6B7280' }}>
          {selectedPlan.interval === 'annual' && selectedPlan.annualCents
            ? `Billed annually (${formatCents(selectedPlan.annualCents)}/yr) · Save 15%`
            : 'Billed monthly · Cancel anytime'}
        </div>
      </div>

      {/* Wallet pay button */}
      {paymentRequest && (
        <>
          <div style={{ marginBottom: '12px' }}>
            <PaymentRequestButtonElement
              options={{
                paymentRequest,
                style: { paymentRequestButton: { theme: 'dark', height: '44px' } },
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                color: '#9CA3AF',
                whiteSpace: 'nowrap',
              }}
            >
              Or pay with card
            </span>
            <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
          </div>
        </>
      )}

      {/* Stripe PaymentElement */}
      <div style={{ marginBottom: '16px' }}>
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {/* Name on card */}
      <div style={{ marginBottom: '20px' }}>
        <label
          htmlFor="checkout-name"
          style={{
            display: 'block',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            fontWeight: 500,
            color: '#374151',
            marginBottom: '6px',
          }}
        >
          Name on card
        </label>
        <input
          id="checkout-name"
          type="text"
          value={nameOnCard}
          onChange={(e) => setNameOnCard(e.target.value)}
          placeholder="Jane Smith"
          disabled={isProcessing}
          style={{
            width: '100%',
            height: '40px',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            padding: '0 12px',
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            color: '#2E2E2E',
            background: isProcessing ? '#F9FAFB' : 'white',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#0FA3B1'
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(15,163,177,0.12)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#D1D5DB'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
          }}
        >
          <AlertCircle size={15} style={{ color: '#DC2626', flexShrink: 0, marginTop: '1px' }} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#B91C1C', lineHeight: '1.5' }}>
            {error}
          </span>
        </div>
      )}

      {/* Subscribe button */}
      <button
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        style={{
          width: '100%',
          minHeight: '44px',
          borderRadius: '8px',
          background: isProcessing ? '#7DD3D8' : '#0FA3B1',
          color: 'white',
          border: 'none',
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          fontWeight: 600,
          cursor: isProcessing || !stripe || !elements ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        {isProcessing && <Spinner />}
        {subscribeBtnLabel}
      </button>

      {/* Cancel link */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          style={{
            background: 'none',
            border: 'none',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: isProcessing ? '#D1D5DB' : '#6B7280',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            padding: 0,
          }}
        >
          Cancel
        </button>
      </div>

      {/* Security note */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
        <Lock size={11} style={{ color: '#9CA3AF' }} />
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#9CA3AF' }}>
          Secured by Stripe
        </span>
      </div>
    </form>
  )
}

// ---- Outer modal shell ----

export function CheckoutModal({ selectedPlan, orgId, onSuccess, onClose }: CheckoutModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [isLoadingIntent, setIsLoadingIntent] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const fetchCountRef = useRef(0)

  const fetchIntent = useCallback(async () => {
    const fetchId = ++fetchCountRef.current
    setIsLoadingIntent(true)
    setSetupError(null)
    setClientSecret(null)
    try {
      const { client_secret } = await createSetupIntent(orgId)
      if (fetchId !== fetchCountRef.current) return
      setClientSecret(client_secret)
    } catch {
      if (fetchId !== fetchCountRef.current) return
      setSetupError('Unable to initialize payment. Please try again.')
    } finally {
      if (fetchId === fetchCountRef.current) setIsLoadingIntent(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchIntent()
  }, [fetchIntent])

  // Escape key
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isProcessing) onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isProcessing, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose()
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          width: '100%',
          maxWidth: '480px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '28px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px',
          }}
        >
          <h2
            id="checkout-modal-title"
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '20px',
              fontWeight: 700,
              color: '#2E2E2E',
              margin: 0,
            }}
          >
            Subscribe to {selectedPlan.displayName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              color: isProcessing ? '#E5E7EB' : '#9CA3AF',
              padding: '2px',
              display: 'flex',
              flexShrink: 0,
              marginLeft: '12px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Loading setup intent */}
        {isLoadingIntent && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '48px 0',
            }}
          >
            <LargeSpinner />
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: '#6B7280',
                margin: '16px 0 0',
              }}
            >
              Initializing secure checkout…
            </p>
          </div>
        )}

        {/* Setup intent error */}
        {!isLoadingIntent && setupError && (
          <div style={{ paddingBottom: '8px' }}>
            <div
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '20px',
              }}
            >
              <AlertCircle size={15} style={{ color: '#DC2626', flexShrink: 0, marginTop: '1px' }} />
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  color: '#B91C1C',
                }}
              >
                {setupError}
              </span>
            </div>
            <button
              type="button"
              onClick={fetchIntent}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                width: '100%',
                height: '40px',
                border: '1px solid #0FA3B1',
                borderRadius: '8px',
                background: 'white',
                color: '#0FA3B1',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={14} />
              Retry
            </button>
          </div>
        )}

        {/* Stripe Elements + form */}
        {!isLoadingIntent && !setupError && clientSecret && (
          <Elements
            key={clientSecret}
            stripe={stripePromise}
            options={{ clientSecret, appearance: STRIPE_APPEARANCE }}
          >
            <CheckoutForm
              selectedPlan={selectedPlan}
              orgId={orgId}
              onSuccess={onSuccess}
              onClose={onClose}
              onProcessingChange={setIsProcessing}
            />
          </Elements>
        )}
      </div>

      <style>{`
        @keyframes co-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

// ---- Micro components ----

function Spinner() {
  return (
    <span
      style={{
        width: '14px',
        height: '14px',
        border: '2px solid rgba(255,255,255,0.35)',
        borderTopColor: 'white',
        borderRadius: '50%',
        animation: 'co-spin 0.6s linear infinite',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )
}

function LargeSpinner() {
  return (
    <span
      style={{
        width: '36px',
        height: '36px',
        border: '3px solid #F3F4F6',
        borderTopColor: '#0FA3B1',
        borderRadius: '50%',
        animation: 'co-spin 0.7s linear infinite',
        display: 'block',
      }}
    />
  )
}

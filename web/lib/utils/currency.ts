export function formatCents(cents: number): string {
  return `$${(Math.round(cents) / 100).toFixed(2)}`;
}

export interface FeeBreakdown {
  stripeFeeCents: number;
  wayfieldFeeCents: number;
  payoutCents: number;
}

export function calcFees(amountCents: number, takeRatePct: number): FeeBreakdown {
  if (amountCents <= 0) {
    return { stripeFeeCents: 0, wayfieldFeeCents: 0, payoutCents: 0 };
  }
  const stripeFeeCents = Math.floor(amountCents * 0.029) + 30;
  // Spec formula: multiply by 100 then floor to avoid float drift, divide back
  const wayfieldFeeCents = Math.floor(amountCents * takeRatePct * 100) / 100;
  const payoutCents = Math.max(0, amountCents - stripeFeeCents - wayfieldFeeCents);
  return { stripeFeeCents, wayfieldFeeCents, payoutCents };
}

export const TAKE_RATE_BY_PLAN: Record<string, number> = {
  free: 2.0,
  starter: 2.0,
  pro: 1.5,
  enterprise: 1.0,
};

export const PLAN_LABEL: Record<string, string> = {
  free: 'Foundation',
  starter: 'Creator',
  pro: 'Studio',
  enterprise: 'Enterprise',
};

/** Plans that include deposit payment functionality (Creator / Studio / Enterprise) */
export const DEPOSIT_PLANS = new Set(['starter', 'pro', 'enterprise']);

/** Plans that include price tier functionality (Creator / Studio / Enterprise) */
export const TIER_PLANS = new Set(['starter', 'pro', 'enterprise']);

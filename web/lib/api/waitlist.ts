import { apiGet } from './client';

export interface WaitlistPaymentIntent {
  client_secret: string;
  stripe_publishable_key: string;
  amount_cents: number;
  formatted_amount: string;
  window_expires_at: string;
  workshop_title: string | null;
  workshop_slug: string | null;
}

export function getWaitlistPaymentIntent(workshopSlug: string): Promise<WaitlistPaymentIntent> {
  return apiGet(`/workshops/${workshopSlug}/waitlist-payment-intent`);
}

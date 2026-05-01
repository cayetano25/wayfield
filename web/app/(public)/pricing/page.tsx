import type { Metadata } from 'next';
import { PricingClient } from './PricingClient';

export const metadata: Metadata = {
  title: 'Pricing | Wayfield',
  description:
    'Simple, honest pricing for workshop operators. Start free — no credit card required. Scale with Creator and Studio plans as your workshop business grows.',
};

export default function PricingPage() {
  return <PricingClient />;
}

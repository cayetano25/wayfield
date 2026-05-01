import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing | Wayfield',
  description:
    "Simple pricing that grows with your workshop program. Start free — upgrade when you're ready.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

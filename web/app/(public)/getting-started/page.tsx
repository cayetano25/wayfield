import type { Metadata } from 'next';
import { GettingStartedClient } from './GettingStartedClient';

export const metadata: Metadata = {
  title: 'Getting Started with Wayfield',
  description:
    'Step-by-step guide for participants and organizers. Learn how to join workshops, build schedules, manage leaders, and accept payments.',
  openGraph: {
    title: 'Getting Started with Wayfield',
    description:
      'Step-by-step guide for participants and organizers. Learn how to join workshops, build schedules, manage leaders, and accept payments.',
    type: 'website',
    siteName: 'Wayfield',
  },
  twitter: { card: 'summary', title: 'Getting Started with Wayfield' },
  robots: { index: true, follow: true },
};

export default function GettingStartedPage() {
  return (
    <div className="mx-auto px-6 py-16" style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h1
          className="font-heading font-bold"
          style={{ fontSize: 40, color: '#2E2E2E', marginBottom: 16, lineHeight: 1.15 }}
        >
          Getting Started with Wayfield
        </h1>
        <p
          className="font-sans"
          style={{ fontSize: 17, color: '#6B7280', lineHeight: 1.65, maxWidth: 560, margin: '0 auto' }}
        >
          Whether you&apos;re attending your first workshop or running one,
          we&apos;ve made it straightforward. Choose your path below.
        </p>
      </div>

      {/* Divider */}
      <div
        style={{
          width: 48,
          height: 3,
          background: '#0FA3B1',
          borderRadius: 2,
          margin: '28px auto 48px',
        }}
      />

      {/* Interactive content */}
      <GettingStartedClient />
    </div>
  );
}

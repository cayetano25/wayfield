import type { Metadata } from 'next';
import Link from 'next/link';
import { AppTopNav } from '@/components/nav/AppTopNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { CartProvider } from '@/contexts/CartContext';
import { SystemAnnouncementBanner } from '@/components/shared/SystemAnnouncementBanner';
import FeatureHighlights from '@/components/landing/FeatureHighlights';

export const metadata: Metadata = {
  title: 'Wayfield — Creative Workshop Management',
  description:
    'Discover and run photography workshops, creative retreats, and immersive learning experiences. Built for participants and organizers alike.',
  openGraph: {
    title: 'Wayfield — Creative Workshop Management',
    description:
      'Discover and run photography workshops, creative retreats, and immersive learning experiences.',
    type: 'website',
    siteName: 'Wayfield',
    images: [{ url: 'https://wayfield.app/images/og-default.jpg' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wayfield — Creative Workshop Management',
    description:
      'Discover and run photography workshops, creative retreats, and immersive learning experiences.',
  },
  robots: { index: true, follow: true },
};

/* ── Testimonial placeholders ────────────────────────────────────────────── */

const TESTIMONIALS = [
  {
    quote:
      'Wayfield made managing a 200-person photography retreat feel effortless. The session selection and attendance tools saved us hours.',
    name: 'Sarah M.',
    role: 'Workshop Organizer',
    initials: 'SM',
  },
  {
    quote:
      'I attended three workshops last year through Wayfield. Being able to build my own schedule and check in offline was a game changer.',
    name: 'James K.',
    role: 'Participant',
    initials: 'JK',
  },
  {
    quote:
      'As a leader, having roster access only for my sessions gives me exactly what I need without the noise. It just works.',
    name: 'Priya R.',
    role: 'Workshop Leader',
    initials: 'PR',
  },
];

/* ── Page ─────────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <CartProvider>
      <div className="min-h-screen bg-white flex flex-col">
        <AppTopNav />

        <main className="pt-14 flex-1">
          <SystemAnnouncementBanner />
          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <section
            style={{
              background:
                'linear-gradient(135deg, #0c6b75 0%, #0FA3B1 35%, #1a1a2e 80%, #2E2E2E 100%)',
              padding: '80px 24px 96px',
            }}
          >
            <div className="mx-auto text-center" style={{ maxWidth: 720 }}>
              <p
                className="font-mono uppercase tracking-widest"
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 20 }}
              >
                Creative Education Platform
              </p>
              <h1
                className="font-heading font-bold"
                style={{
                  fontSize: 'clamp(36px, 6vw, 58px)',
                  color: 'white',
                  lineHeight: 1.12,
                  marginBottom: 24,
                }}
              >
                Where Creative Education
                <br />
                Comes to Life
              </h1>
              <p
                className="font-sans"
                style={{
                  fontSize: 18,
                  color: 'rgba(255,255,255,0.8)',
                  lineHeight: 1.65,
                  marginBottom: 40,
                  maxWidth: 540,
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                Discover and join photography workshops, creative retreats, and
                hands-on learning experiences led by world-class instructors.
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <Link
                  href="/workshops"
                  className="font-sans font-semibold transition-opacity hover:opacity-90"
                  style={{
                    display: 'inline-block',
                    background: '#0FA3B1',
                    color: 'white',
                    borderRadius: 8,
                    padding: '14px 32px',
                    fontSize: 15,
                    textDecoration: 'none',
                    boxShadow: '0 4px 14px rgba(15,163,177,0.4)',
                  }}
                >
                  Explore Workshops
                </Link>
                <Link
                  href="/register"
                  className="font-sans font-semibold transition-colors hover:bg-white hover:text-primary"
                  style={{
                    display: 'inline-block',
                    background: 'transparent',
                    color: 'white',
                    border: '2px solid rgba(255,255,255,0.5)',
                    borderRadius: 8,
                    padding: '14px 32px',
                    fontSize: 15,
                    textDecoration: 'none',
                  }}
                >
                  Get Started Free
                </Link>
              </div>
            </div>
          </section>

          {/* ── Features ──────────────────────────────────────────────────── */}
          <FeatureHighlights />

          {/* ── Pricing callout ───────────────────────────────────────────── */}
          <section
            style={{
              background: 'white',
              padding: '72px 24px',
              borderTop: '1px solid #F3F4F6',
            }}
          >
            <div
              className="mx-auto"
              style={{
                maxWidth: 760,
                textAlign: 'center',
                background: 'linear-gradient(135deg, #0FA3B1 0%, #0891B2 100%)',
                borderRadius: 16,
                padding: '56px 40px',
                boxShadow: '0 8px 32px rgba(15,163,177,0.25)',
              }}
            >
              <p
                className="font-mono uppercase tracking-widest"
                style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginBottom: 16 }}
              >
                Pricing
              </p>
              <h2
                className="font-heading font-bold"
                style={{ fontSize: 30, color: 'white', marginBottom: 14 }}
              >
                Plans starting free — grow as you go
              </h2>
              <p
                className="font-sans"
                style={{
                  fontSize: 16,
                  color: 'rgba(255,255,255,0.85)',
                  lineHeight: 1.65,
                  marginBottom: 32,
                  maxWidth: 480,
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                The Free plan covers everything you need to run your first workshop.
                Upgrade to Starter or Pro when you&apos;re ready for waitlists,
                payments, and advanced tools.
              </p>
              <Link
                href="/pricing"
                className="font-sans font-semibold transition-opacity hover:opacity-90"
                style={{
                  display: 'inline-block',
                  background: 'white',
                  color: '#0FA3B1',
                  borderRadius: 8,
                  padding: '14px 32px',
                  fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                View pricing →
              </Link>
            </div>
          </section>

          {/* ── Social proof ──────────────────────────────────────────────── */}
          <section style={{ background: '#F9FAFB', padding: '72px 24px' }}>
            <div className="mx-auto" style={{ maxWidth: 1100 }}>
              <div style={{ textAlign: 'center', marginBottom: 48 }}>
                <h2
                  className="font-heading font-bold"
                  style={{ fontSize: 28, color: '#2E2E2E', marginBottom: 10 }}
                >
                  Loved by organizers, leaders, and participants
                </h2>
                <p
                  className="font-sans"
                  style={{ fontSize: 15, color: '#9CA3AF' }}
                >
                  Here&apos;s what people are saying about Wayfield.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {TESTIMONIALS.map((t) => (
                  <div
                    key={t.name}
                    style={{
                      background: 'white',
                      border: '1px solid #E5E7EB',
                      borderRadius: 12,
                      padding: '28px 24px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    }}
                  >
                    <p
                      className="font-sans"
                      style={{
                        fontSize: 15,
                        color: '#374151',
                        lineHeight: 1.7,
                        marginBottom: 24,
                        fontStyle: 'italic',
                      }}
                    >
                      &ldquo;{t.quote}&rdquo;
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        className="font-heading font-bold"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #0FA3B1, #0891B2)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        {t.initials}
                      </div>
                      <div>
                        <p
                          className="font-sans font-semibold"
                          style={{ fontSize: 14, color: '#2E2E2E' }}
                        >
                          {t.name}
                        </p>
                        <p
                          className="font-sans"
                          style={{ fontSize: 12, color: '#9CA3AF' }}
                        >
                          {t.role}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Final CTA ─────────────────────────────────────────────────── */}
          <section
            style={{
              background: 'white',
              padding: '80px 24px',
              textAlign: 'center',
              borderTop: '1px solid #F3F4F6',
            }}
          >
            <h2
              className="font-heading font-bold"
              style={{ fontSize: 32, color: '#2E2E2E', marginBottom: 16 }}
            >
              Ready to get started?
            </h2>
            <p
              className="font-sans"
              style={{
                fontSize: 17,
                color: '#6B7280',
                marginBottom: 32,
                maxWidth: 440,
                margin: '0 auto 32px',
              }}
            >
              Join workshops as a participant, or create and manage your own as an
              organizer — it starts free.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                href="/getting-started"
                className="font-sans font-semibold transition-opacity hover:opacity-90"
                style={{
                  display: 'inline-block',
                  background: '#0FA3B1',
                  color: 'white',
                  borderRadius: 8,
                  padding: '14px 32px',
                  fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                How it works
              </Link>
              <Link
                href="/workshops"
                className="font-sans font-semibold transition-colors"
                style={{
                  display: 'inline-block',
                  background: 'transparent',
                  color: '#0FA3B1',
                  border: '2px solid #0FA3B1',
                  borderRadius: 8,
                  padding: '14px 32px',
                  fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                Browse Workshops
              </Link>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </CartProvider>
  );
}

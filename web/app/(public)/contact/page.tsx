import type { Metadata } from 'next';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact Wayfield',
  description:
    'Have questions about workshops, organizer plans, or partnerships? Get in touch with the Wayfield team.',
  openGraph: {
    title: 'Contact Wayfield',
    description:
      'Have questions about workshops, organizer plans, or partnerships? Get in touch with the Wayfield team.',
    type: 'website',
    siteName: 'Wayfield',
  },
  twitter: { card: 'summary', title: 'Contact Wayfield' },
  robots: { index: true, follow: true },
};

const CONTACT_CARDS = [
  {
    icon: '✉️',
    label: 'General',
    value: 'hello@wayfield.app',
    href: 'mailto:hello@wayfield.app',
  },
  {
    icon: '🛠️',
    label: 'Support',
    value: 'support@wayfield.app',
    href: 'mailto:support@wayfield.app',
  },
  {
    icon: '📰',
    label: 'Press',
    value: 'press@wayfield.app',
    href: 'mailto:press@wayfield.app',
  },
];

export default function ContactPage() {
  return (
    <>
    <style>{`.contact-card:hover { border-color: #0FA3B1 !important; }`}</style>
    <div
      className="mx-auto px-6 py-16"
      style={{ maxWidth: 1100 }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 56, maxWidth: 560 }}>
        <h1
          className="font-heading font-bold"
          style={{ fontSize: 40, color: '#2E2E2E', marginBottom: 16, lineHeight: 1.15 }}
        >
          Contact Wayfield
        </h1>
        <p
          className="font-sans"
          style={{ fontSize: 17, color: '#6B7280', lineHeight: 1.65 }}
        >
          Have questions about workshops, organizer plans, or partnerships?
          We&apos;d love to hear from you.
        </p>
      </div>

      {/* Two-column layout */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-16"
        style={{ alignItems: 'start' }}
      >
        {/* Left: contact info */}
        <div>
          <h2
            className="font-heading font-bold"
            style={{ fontSize: 24, color: '#2E2E2E', marginBottom: 24 }}
          >
            Get in touch
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
            {CONTACT_CARDS.map(({ icon, label, value, href }) => (
              <a
                key={label}
                href={href}
                className="contact-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 20px',
                  background: '#F9FAFB',
                  border: '1px solid #E5E7EB',
                  borderRadius: 10,
                  textDecoration: 'none',
                  transition: 'border-color 150ms',
                }}
              >
                <span style={{ fontSize: 22 }}>{icon}</span>
                <div>
                  <p
                    className="font-sans"
                    style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 2 }}
                  >
                    {label}
                  </p>
                  <p
                    className="font-sans font-medium"
                    style={{ fontSize: 14, color: '#0FA3B1' }}
                  >
                    {value}
                  </p>
                </div>
              </a>
            ))}
          </div>

          <div
            style={{
              background: 'linear-gradient(135deg, #0FA3B1 0%, #0891B2 100%)',
              borderRadius: 12,
              padding: '24px 28px',
            }}
          >
            <p
              className="font-heading font-bold"
              style={{ fontSize: 16, color: 'white', marginBottom: 8 }}
            >
              Running a workshop?
            </p>
            <p
              className="font-sans"
              style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, marginBottom: 16 }}
            >
              Start for free and upgrade as you grow. Wayfield handles scheduling,
              leader management, attendance, and payments so you can focus on
              the creative work.
            </p>
            <a
              href="/getting-started"
              className="font-sans font-semibold"
              style={{
                display: 'inline-block',
                background: 'white',
                color: '#0FA3B1',
                borderRadius: 8,
                padding: '9px 20px',
                fontSize: 14,
                textDecoration: 'none',
              }}
            >
              How it works →
            </a>
          </div>
        </div>

        {/* Right: form */}
        <div
          style={{
            background: 'white',
            border: '1px solid #E5E7EB',
            borderRadius: 12,
            padding: '32px 28px',
            boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
          }}
        >
          <h2
            className="font-heading font-bold"
            style={{ fontSize: 22, color: '#2E2E2E', marginBottom: 24 }}
          >
            Send us a message
          </h2>
          <ContactForm />
        </div>
      </div>
    </div>
    </>
  );
}

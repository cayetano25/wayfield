'use client';

import { useState } from 'react';
import Link from 'next/link';

type Audience = 'participant' | 'organizer';

interface Step {
  title: string;
  description: string;
  link?: { label: string; href: string };
}

const PARTICIPANT_STEPS: Step[] = [
  {
    title: 'Create your account',
    description:
      'Sign up with your email address and a secure password. No separate accounts per role — one profile serves every context you hold.',
    link: { label: 'Create account', href: '/register' },
  },
  {
    title: 'Browse workshops',
    description:
      'Explore photography workshops, creative retreats, and hands-on learning experiences on the discover page. Filter by location, format, or date.',
    link: { label: 'Browse workshops', href: '/workshops' },
  },
  {
    title: 'Join with a code or register directly',
    description:
      "Your organizer will share a join code. Enter it from the home screen or use it in the app to instantly connect to your workshop.",
  },
  {
    title: 'Build your schedule',
    description:
      'For session-based workshops, choose the sessions you want to attend. The system prevents overlapping selections and enforces any capacity limits automatically.',
  },
  {
    title: 'Check in on the day',
    description:
      'Self check-in via the app or wait for a leader to mark your attendance. The mobile app works offline — no connectivity needed in the field.',
  },
];

const ORGANIZER_STEPS: Step[] = [
  {
    title: 'Create your organization',
    description:
      'Set up your organization with your name, logo, and contact details. You can invite additional managers (admin, staff, or billing roles) later.',
  },
  {
    title: 'Build your first workshop',
    description:
      'Add your workshop title, dates, timezone, and location. Choose between session-based (with selectable tracks) or event-based (simpler schedule) format.',
  },
  {
    title: 'Invite leaders',
    description:
      'Send invitation emails to your workshop leaders. Leaders own their own profile — fill in their bio, headshot, and specialties themselves after accepting.',
  },
  {
    title: 'Share your join code with participants',
    description:
      'Each workshop gets a unique join code. Share it with registrants so they can connect, browse sessions, and build their personal schedule.',
  },
  {
    title: 'Manage attendance on the day',
    description:
      'Leaders can check participants in, mark no-shows, and send notifications from within their assigned sessions. Organizers see everything in real time.',
  },
  {
    title: 'Accept payments',
    description:
      'Upgrade to Starter or Pro to unlock payment collection, waitlists, branded pages, and advanced reporting.',
    link: { label: 'View pricing', href: '/pricing' },
  },
];

function StepItem({ step, index }: { step: Step; index: number }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 20,
        paddingBottom: 32,
      }}
    >
      {/* Circle number */}
      <div style={{ flexShrink: 0 }}>
        <div
          className="font-heading font-bold"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#0FA3B1',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
        >
          {index + 1}
        </div>
      </div>

      {/* Content */}
      <div style={{ paddingTop: 6 }}>
        <h3
          className="font-heading font-bold"
          style={{ fontSize: 17, color: '#2E2E2E', marginBottom: 8 }}
        >
          {step.title}
        </h3>
        <p
          className="font-sans"
          style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.65, marginBottom: step.link ? 12 : 0 }}
        >
          {step.description}
        </p>
        {step.link && (
          <a
            href={step.link.href}
            className="font-sans font-semibold transition-colors hover:opacity-80"
            style={{ fontSize: 14, color: '#0FA3B1', textDecoration: 'none' }}
          >
            {step.link.label} →
          </a>
        )}
      </div>
    </div>
  );
}

export function GettingStartedClient() {
  const [audience, setAudience] = useState<Audience>('participant');

  const steps = audience === 'participant' ? PARTICIPANT_STEPS : ORGANIZER_STEPS;

  return (
    <>
      {/* Audience toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 56 }}>
        <div
          style={{
            display: 'inline-flex',
            background: '#F3F4F6',
            borderRadius: 10,
            padding: 4,
            gap: 4,
          }}
          role="tablist"
          aria-label="Select your role"
        >
          {(['participant', 'organizer'] as Audience[]).map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={audience === a}
              onClick={() => setAudience(a)}
              className="font-sans font-semibold transition-all"
              style={{
                padding: '10px 24px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                background: audience === a ? '#0FA3B1' : 'transparent',
                color: audience === a ? 'white' : '#6B7280',
                boxShadow: audience === a ? '0 1px 4px rgba(15,163,177,0.3)' : 'none',
              }}
            >
              {a === 'participant' ? "I'm a participant" : "I'm an organizer"}
            </button>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div
        style={{
          maxWidth: 640,
          margin: '0 auto',
          borderLeft: '2px solid #E5E7EB',
          paddingLeft: 0,
        }}
      >
        {steps.map((step, i) => (
          <StepItem key={step.title} step={step} index={i} />
        ))}
      </div>

      {/* CTA at bottom */}
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        {audience === 'participant' ? (
          <Link
            href="/register"
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
            Create your free account
          </Link>
        ) : (
          <Link
            href="/onboarding"
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
            Start your organization
          </Link>
        )}
      </div>
    </>
  );
}

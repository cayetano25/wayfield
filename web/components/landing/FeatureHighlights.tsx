'use client';

import {
  ParticipantIcon,
  OrganizerIcon,
  AnyFormatIcon,
  OfflineReadyIcon,
} from '@/components/icons';

const features = [
  {
    Icon: ParticipantIcon,
    label: 'For Participants',
    description:
      'Join workshops by code. Select sessions, check yourself in, and access everything you need — all in one place.',
  },
  {
    Icon: OrganizerIcon,
    label: 'For Organizers',
    description:
      'Build and manage workshops with full control over sessions, leaders, participants, and logistics.',
  },
  {
    Icon: AnyFormatIcon,
    label: 'Any Format',
    description:
      'Run in-person, virtual, or hybrid workshops. Wayfield adapts to how you teach.',
  },
  {
    Icon: OfflineReadyIcon,
    label: 'Offline Ready',
    description:
      'Participants and leaders can check in and access session details even without a signal.',
  },
] as const;

export default function FeatureHighlights() {
  return (
    <section style={{ background: '#F9FAFB', padding: '72px 24px' }}>
      <div className="mx-auto" style={{ maxWidth: 1100 }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <h2
            className="font-heading font-bold"
            style={{ fontSize: 32, color: '#2E2E2E', marginBottom: 12 }}
          >
            Everything you need, nothing you don&apos;t
          </h2>
          <p
            className="font-sans"
            style={{ fontSize: 16, color: '#6B7280', maxWidth: 480, margin: '0 auto' }}
          >
            Wayfield is purpose-built for creative workshops — from a single
            photography retreat to a multi-track conference.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map(({ Icon, label, description }) => (
            <div
              key={label}
              style={{
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: 12,
                padding: '28px 24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'rgba(15,163,177,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={24} color="#334155" accent="#0FA3B1" aria-hidden />
              </div>
              <h3
                className="font-heading font-bold"
                style={{ fontSize: 16, color: '#2E2E2E', margin: 0 }}
              >
                {label}
              </h3>
              <p
                className="font-sans"
                style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.65, margin: 0 }}
              >
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

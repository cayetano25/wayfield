import { CalendarDays, Users, ClipboardCheck } from 'lucide-react'
import { BackgroundRotator } from './BackgroundRotator'
import { WorkshopPreviewCard } from './WorkshopPreviewCard'

const features = [
  {
    icon: CalendarDays,
    title: 'Instant Smart Scheduling',
    sub: 'Conflict-free planning and session coordination',
  },
  {
    icon: Users,
    title: 'Leader Engagement',
    sub: 'Simplified instructor onboarding and communication',
  },
  {
    icon: ClipboardCheck,
    title: 'Real-time Attendance',
    sub: 'Digital check-ins and live attendance tracking',
  },
]

export function MarketingPanel() {
  return (
    <div className="relative overflow-hidden h-full flex flex-col">
      {/* Background with crossfade rotator */}
      <BackgroundRotator />

      {/* All content sits above background and overlay */}
      <div
        className="relative flex flex-col h-full px-12 py-10 overflow-y-auto items-center justify-center"
        style={{ zIndex: 10 }}
      >
        {/* Microcopy */}
        <p
          style={{
            fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
            fontSize: '11px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.14em',
            paddingTop: '8px',
          }}
        >
          WORKSHOPS &nbsp;·&nbsp; LEADERS &nbsp;·&nbsp; LOGISTICS
        </p>

        {/* Hero headline */}
        <h2
          style={{
            fontFamily: 'var(--font-sora), Sora, sans-serif',
            fontSize: 'clamp(32px, 3.2vw, 44px)',
            fontWeight: 800,
            lineHeight: 1.15,
            maxWidth: '480px',
            marginTop: '24px',
            animation: 'fadeSlideUp 0.7s ease-out',
          }}
        >
          <span style={{ color: 'white' }}>Every workshop,</span>
          <span style={{ color: '#0FA3B1' }}> perfectly</span>
          <span style={{ color: 'white' }}> organized.</span>
        </h2>

        {/* Supporting paragraph */}
        <p
          style={{
            fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
            fontSize: '15px',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.72)',
            lineHeight: 1.65,
            maxWidth: '400px',
            marginTop: '16px',
          }}
        >
          Wayfield brings together scheduling, attendance tracking, and real-time
          coordination into one seamless platform.
        </p>

        {/* Workshop preview card */}
        <div style={{ marginTop: '32px', maxWidth: '420px' }}>
          <WorkshopPreviewCard />
        </div>

        {/* Feature highlights */}
        <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {features.map(({ icon: Icon, title, sub }) => (
            <div key={title} className="flex items-start" style={{ gap: '14px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={16} style={{ color: '#0FA3B1' }} aria-hidden="true" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'white',
                  }}
                >
                  {title}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                    fontSize: '12px',
                    fontWeight: 400,
                    color: 'rgba(255,255,255,0.55)',
                  }}
                >
                  {sub}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer tagline */}
        <p
          style={{
            marginTop: '32px',
            paddingBottom: '0',
            fontFamily: 'var(--font-sora), Sora, sans-serif',
            fontSize: '13px',
            fontStyle: 'italic',
            color: 'rgba(255,255,255,0.45)',
            animation: 'fadeSlideUp 0.6s ease-out 0.5s both',
          }}
        >
          Organize with clarity. Lead with confidence.
        </p>
      </div>
    </div>
  )
}

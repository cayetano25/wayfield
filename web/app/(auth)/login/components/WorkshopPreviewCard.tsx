import { Calendar, MapPin } from 'lucide-react'

export function WorkshopPreviewCard() {
  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '20px 24px',
        animation: 'slideUpFade 0.6s ease-out 0.3s both',
      }}
    >
      {/* Top row: badges */}
      <div className="flex items-center justify-between">
        <span
          style={{
            background: '#0FA3B1',
            color: 'white',
            fontSize: '10px',
            fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '3px 10px',
            borderRadius: '9999px',
          }}
        >
          UPCOMING
        </span>
        <span
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: '10px',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: '4px',
          }}
        >
          IN PERSON
        </span>
      </div>

      {/* Workshop title */}
      <div
        style={{
          fontFamily: 'var(--font-sora), Sora, sans-serif',
          fontSize: '17px',
          fontWeight: 700,
          color: 'white',
          marginTop: '12px',
        }}
      >
        Natural Light &amp; Portraiture 2025
      </div>

      {/* Meta row */}
      <div
        className="flex items-center flex-wrap"
        style={{ gap: '16px', marginTop: '8px' }}
      >
        <div className="flex items-center gap-1">
          <Calendar
            size={14}
            style={{ color: 'rgba(255,255,255,0.55)', flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: '12px',
              fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            June 14–17, 2025
          </span>
        </div>
        <div className="flex items-center gap-1">
          <MapPin
            size={14}
            style={{ color: 'rgba(255,255,255,0.55)', flexShrink: 0 }}
          />
          <span
            style={{
              fontSize: '12px',
              fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            Sedona, AZ
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div
        className="grid grid-cols-3"
        style={{ gap: '8px', marginTop: '16px' }}
      >
        {[
          { value: '48', label: 'PARTICIPANTS' },
          { value: '6', label: 'SESSIONS' },
          { value: '3', label: 'LEADERS' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '8px',
              padding: '10px 8px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-sora), Sora, sans-serif',
                fontSize: '22px',
                fontWeight: 700,
                color: 'white',
              }}
            >
              {stat.value}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
                fontSize: '9px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.5)',
                letterSpacing: '0.06em',
                marginTop: '2px',
              }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Capacity section */}
      <div style={{ marginTop: '16px' }}>
        <div className="flex items-center justify-between">
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            Capacity Utilization
          </span>
          <span
            style={{
              fontSize: '12px',
              fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif',
              fontWeight: 600,
              color: '#0FA3B1',
            }}
          >
            78%
          </span>
        </div>
        <div
          style={{
            marginTop: '6px',
            height: '4px',
            background: 'rgba(255,255,255,0.12)',
            borderRadius: '9999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '78%',
              height: '100%',
              background: '#0FA3B1',
              borderRadius: '9999px',
              boxShadow: '0 0 8px rgba(15, 163, 177, 0.6)',
            }}
          />
        </div>
      </div>
    </div>
  )
}

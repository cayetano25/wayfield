export default function InvitationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', flexDirection: 'column' }}>
      {/* Minimal header */}
      <header
        style={{
          background: 'white',
          borderBottom: '1px solid #E5E7EB',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 32px',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sora), Sora, sans-serif',
            fontSize: '20px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}
        >
          <span style={{ color: '#2E2E2E' }}>Way</span>
          <span style={{ color: '#0FA3B1' }}>field</span>
        </span>
      </header>

      {/* Page content */}
      <main style={{ flex: 1, padding: '40px 16px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '520px' }}>
          {children}
        </div>
      </main>
    </div>
  )
}

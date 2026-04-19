// components/nav/GuestActions.tsx

import Link from 'next/link'

export function GuestActions() {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/login"
        style={{
          fontFamily:     'Plus Jakarta Sans, sans-serif',
          fontSize:       14,
          fontWeight:     400,
          color:          '#374151',
          textDecoration: 'none',
        }}
        className="hover:text-[#2E2E2E] transition-colors duration-100"
      >
        Sign In
      </Link>

      <Link
        href="/register"
        className="inline-flex items-center transition-colors duration-100"
        style={{
          fontFamily:      'Plus Jakarta Sans, sans-serif',
          fontSize:        13,
          fontWeight:      600,
          color:           '#ffffff',
          backgroundColor: '#0FA3B1',
          padding:         '7px 16px',
          borderRadius:    8,
          textDecoration:  'none',
          height:          36,
          lineHeight:      '22px',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#0891B2'
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#0FA3B1'
        }}
      >
        Create Account
      </Link>
    </div>
  )
}

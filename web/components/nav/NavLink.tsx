// components/nav/NavLink.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavLinkProps {
  href:   string
  label:  string
  exact?: boolean
  onClick?: () => void
}

export function NavLink({ href, label, exact = false, onClick }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      onClick={onClick}
      className="relative inline-flex items-center h-full px-1 transition-colors
                 duration-100 whitespace-nowrap"
      style={{
        fontFamily:  'Plus Jakarta Sans, sans-serif',
        fontSize:    14,
        fontWeight:  isActive ? 500 : 400,
        color:       isActive ? '#0FA3B1' : '#374151',
        textDecoration: 'none',
      }}
    >
      {label}

      {/* Active underline — 2px teal bar at the bottom of the nav */}
      {isActive && (
        <span
          className="absolute bottom-0 left-0 right-0"
          style={{
            height:          2,
            backgroundColor: '#0FA3B1',
            borderRadius:    '1px 1px 0 0',
          }}
          aria-hidden="true"
        />
      )}
    </Link>
  )
}

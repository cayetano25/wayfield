// components/nav/MobileMenu.tsx
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavContextData } from '@/lib/types/nav'

interface MobileMenuProps {
  nav:     NavContextData
  onClose: () => void
}

export function MobileMenu({ nav, onClose }: MobileMenuProps) {
  const pathname = usePathname()

  // Close when route changes (user tapped a link)
  useEffect(() => {
    onClose()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const links = buildLinks(nav)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu panel — drops down from the nav bar */}
      <nav
        className="fixed left-0 right-0 z-40"
        style={{
          top:             56,   // nav bar height
          backgroundColor: '#ffffff',
          borderBottom:    '1px solid #E5E7EB',
          boxShadow:       '0 4px 12px rgba(0,0,0,0.08)',
        }}
        aria-label="Mobile navigation"
      >
        {links.map((link) => {
          const isActive = pathname === link.href ||
                           pathname.startsWith(link.href + '/')
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="flex items-center px-5 transition-colors duration-100"
              style={{
                height:         52,
                fontFamily:     'Plus Jakarta Sans, sans-serif',
                fontSize:       15,
                fontWeight:     isActive ? 600 : 400,
                color:          isActive ? '#0FA3B1' : '#374151',
                textDecoration: 'none',
                borderBottom:   '1px solid #F3F4F6',
                backgroundColor: isActive ? '#F0FDFF' : 'transparent',
              }}
            >
              {link.label}
            </Link>
          )
        })}

        {/* Guest actions in mobile menu */}
        {!nav.isAuthenticated && (
          <div className="flex flex-col gap-3 px-5 py-4">
            <Link
              href="/login"
              onClick={onClose}
              className="flex items-center justify-center"
              style={{
                height:          44,
                borderRadius:    8,
                border:          '1px solid #E5E7EB',
                fontFamily:      'Plus Jakarta Sans, sans-serif',
                fontSize:        14,
                fontWeight:      500,
                color:           '#374151',
                textDecoration:  'none',
                backgroundColor: '#ffffff',
              }}
            >
              Sign In
            </Link>
            <Link
              href="/register"
              onClick={onClose}
              className="flex items-center justify-center"
              style={{
                height:          44,
                borderRadius:    8,
                fontFamily:      'Plus Jakarta Sans, sans-serif',
                fontSize:        14,
                fontWeight:      600,
                color:           '#ffffff',
                textDecoration:  'none',
                backgroundColor: '#0FA3B1',
              }}
            >
              Create Account
            </Link>
          </div>
        )}
      </nav>
    </>
  )
}

function buildLinks(nav: NavContextData): Array<{ href: string; label: string }> {
  const links: Array<{ href: string; label: string }> = [
    { href: '/discover', label: 'Discover' },
  ]
  if (nav.showMyWorkshops)    links.push({ href: '/my-workshops',    label: 'My Workshops' })
  if (nav.showMySessions)     links.push({ href: '/leader/dashboard', label: 'My Sessions' })
  if (nav.showMyOrganization) links.push({ href: '/my-organizations', label: 'My Organizations' })
  return links
}

// components/nav/AppTopNav.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useNavContext } from '@/lib/hooks/useNavContext'
import { NavLink }            from './NavLink'
import { UserMenu }           from './UserMenu'
import { GuestActions }       from './GuestActions'
import { MobileMenu }         from './MobileMenu'
import { NotificationBell }   from '@/components/notifications/NotificationBell'

export function AppTopNav() {
  const nav                         = useNavContext()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* -- NAV BAR ------------------------------------------------- */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-white"
        style={{
          height:     56,
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <div className="h-full flex items-center px-4 sm:px-6">
          {/* -- LEFT: Logo --------------------------------------- */}
          <div className="flex-1 flex items-center">
            <Link
              href="/"
              className="flex-shrink-0 flex items-center"
              style={{ textDecoration: 'none' }}
              aria-label="Wayfield home"
            >
              <span
                style={{
                  fontFamily: 'Sora, sans-serif',
                  fontWeight: 700,
                  fontSize:   20,
                  color:      '#2E2E2E',
                  letterSpacing: '-0.01em',
                }}
              >
                Way
              </span>
              <span
                style={{
                  fontFamily: 'Sora, sans-serif',
                  fontWeight: 700,
                  fontSize:   20,
                  color:      '#0FA3B1',
                  letterSpacing: '-0.01em',
                }}
              >
                field
              </span>
            </Link>
          </div>

          {/* -- CENTER: Desktop nav links ------------------------- */}
          <nav
            className="hidden sm:flex items-center gap-7 h-full"
            aria-label="Main navigation"
          >
            {/* Discover — always visible */}
            <NavLink href="/discover" label="Discover" />

            {/* My Workshops — all authenticated users */}
            {nav.isAuthenticated && (
              <NavLink href="/my-workshops" label="My Workshops" />
            )}

            {/* My Sessions — accepted leaders only */}
            {nav.showMySessions && (
              <NavLink href="/leader/dashboard" label="My Sessions" />
            )}

            {/* My Organizations — any org role */}
            {nav.showMyOrganization && (
              <NavLink href="/my-organizations" label="My Organizations" />
            )}
          </nav>

          {/* -- RIGHT: Profile or guest actions ------------------ */}
          <div className="flex-1 flex items-center justify-end gap-2">

            {/* Loading skeleton — prevents layout shift */}
            {nav.isLoading && (
              <div
                className="rounded-full animate-pulse"
                style={{
                  width:           32,
                  height:          32,
                  backgroundColor: '#E5E7EB',
                }}
                aria-hidden="true"
              />
            )}

            {/* Authenticated user — notification bell + user menu */}
            {!nav.isLoading && nav.isAuthenticated && nav.user && (
              <div className="flex items-center gap-2">
                <NotificationBell isAuthenticated={nav.isAuthenticated} />
                <UserMenu user={nav.user} />
              </div>
            )}

            {/* Guest */}
            {!nav.isLoading && !nav.isAuthenticated && (
              <div className="hidden sm:flex">
                <GuestActions />
              </div>
            )}

            {/* Mobile hamburger — only at < 640px */}
            <button
              className="flex sm:hidden items-center justify-center
                         rounded-lg transition-colors duration-100
                         cursor-pointer"
              style={{
                width:           40,
                height:          40,
                backgroundColor: mobileOpen ? '#F9FAFB' : 'transparent',
                border:          'none',
              }}
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-menu"
            >
              {mobileOpen
                ? <X    size={22} color="#374151" />
                : <Menu size={22} color="#374151" />
              }
            </button>
          </div>
        </div>
      </header>

      {/* -- MOBILE MENU --------------------------------------------- */}
      {mobileOpen && (
        <MobileMenu
          nav={nav}
          onClose={() => setMobileOpen(false)}
        />
      )}
    </>
  )
}

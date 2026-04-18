// components/nav/AppTopNav.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, Megaphone, Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useNavContext } from '@/lib/hooks/useNavContext'
import { NavLink }      from './NavLink'
import { UserMenu }     from './UserMenu'
import { GuestActions } from './GuestActions'
import { MobileMenu }   from './MobileMenu'
import { apiGet } from '@/lib/api/client'

export function AppTopNav() {
  const nav                         = useNavContext()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const router = useRouter()

  useEffect(() => {
    if (!nav.isAuthenticated) return
    apiGet<{ data?: { read_at: string | null }[] } | { read_at: string | null }[]>(
      '/me/notifications',
    )
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : ((res as { data?: { read_at: string | null }[] }).data ?? [])
        setUnreadCount(list.filter((n) => !n.read_at).length)
      })
      .catch(() => {})
  }, [nav.isAuthenticated])

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

            {/* My Organization — any org role */}
            {nav.showMyOrganization && (
              <NavLink href="/admin/dashboard" label="My Organization" />
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

            {/* Authenticated user — icons + separator + user menu */}
            {!nav.isLoading && nav.isAuthenticated && nav.user && (
              <div className="flex items-center gap-2">
                {/* Megaphone */}
                <button
                  type="button"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-medium-gray hover:bg-surface hover:text-dark transition-colors"
                  title="Announcements"
                  aria-label="Announcements"
                >
                  <Megaphone size={20} />
                </button>

                {/* Bell with unread badge */}
                <button
                  type="button"
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg text-medium-gray hover:bg-surface hover:text-dark transition-colors"
                  title="Notifications"
                  aria-label="Notifications"
                  onClick={() => router.push('/notifications')}
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-danger text-white text-[10px] font-semibold leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

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

// components/nav/UserMenu.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  Bell,
  LogOut,
  Receipt,
} from 'lucide-react'
import { UserAvatar } from './UserAvatar'
import { clearNavCache } from '@/lib/hooks/useNavContext'
import { apiPost } from '@/lib/api/client'
import { clearToken, clearStoredUser } from '@/lib/auth/session'
import type { NavUser } from '@/lib/types/nav'

interface UserMenuProps {
  user: NavUser
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen]   = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const triggerRef            = useRef<HTMLButtonElement>(null)
  const dropdownRef           = useRef<HTMLDivElement>(null)
  const router                = useRouter()

  // -- Close on outside click --------------------------------------------
  useEffect(() => {
    if (!isOpen) return

    function handleOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return
      }
      setIsOpen(false)
    }

    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [isOpen])

  // -- Close on Escape key -----------------------------------------------
  useEffect(() => {
    if (!isOpen) return

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen])

  // -- Sign Out ----------------------------------------------------------
  const handleSignOut = useCallback(async () => {
    setIsOpen(false)
    setIsLoggingOut(true)
    try {
      await apiPost('/auth/logout')
    } catch {
      // Always redirect even if the API call fails
    } finally {
      clearToken()
      clearStoredUser()
      clearNavCache()
      router.push('/login')
    }
  }, [router])

  // -- Navigate helper ---------------------------------------------------
  function navigateTo(href: string) {
    setIsOpen(false)
    router.push(href)
  }

  // -- Display name in the trigger ---------------------------------------
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Account'

  return (
    <div className="relative ml-1 pl-3 border-l border-border-gray" data-testid="user-menu-wrapper">
      {/* -- TRIGGER ------------------------------------------------ */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-2 px-1 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors hover:bg-surface"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        data-testid="user-menu-trigger"
        disabled={isLoggingOut}
      >
        <UserAvatar
          firstName={user.first_name}
          lastName={user.last_name}
          profileImageUrl={user.profile_image_url}
          size={32}
        />

        <span
          className="hidden sm:block max-w-[120px] truncate"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize:   13,
            fontWeight: 500,
            color:      '#374151',
          }}
        >
          {displayName}
        </span>
      </button>

      {/* -- DROPDOWN ----------------------------------------------- */}
      {isOpen && (
        <div
          ref={dropdownRef}
          role="menu"
          aria-label="User menu"
          className="absolute right-0 mt-2 origin-top-right"
          style={{
            width:        220,
            backgroundColor: '#ffffff',
            border:       '1px solid #E5E7EB',
            borderRadius: 8,
            boxShadow:    '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
            overflow:     'hidden',
            zIndex:       100,
          }}
        >
          {/* Identity header — not clickable */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ backgroundColor: '#FAFAFA' }}
            aria-hidden="true"
          >
            <UserAvatar
              firstName={user.first_name}
              lastName={user.last_name}
              profileImageUrl={user.profile_image_url}
              size={40}
            />
            <div className="min-w-0">
              <p
                className="truncate"
                style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize:   14,
                  fontWeight: 600,
                  color:      '#2E2E2E',
                  margin:     0,
                }}
              >
                {user.first_name} {user.last_name}
              </p>
              <p
                className="truncate"
                style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize:   12,
                  color:      '#9CA3AF',
                  margin:     0,
                }}
              >
                {user.email}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: '#F3F4F6' }} />

          {/* Profile Settings */}
          <button
            role="menuitem"
            onClick={() => navigateTo('/profile')}
            className="w-full flex items-center gap-3 px-4 py-[10px]
                       transition-colors duration-100 cursor-pointer text-left"
            style={{ backgroundColor: 'transparent', border: 'none' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F9FAFB'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
            }}
          >
            <User size={16} color="#6B7280" aria-hidden="true" />
            <span
              style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize:   13,
                color:      '#374151',
              }}
            >
              Profile Settings
            </span>
          </button>

          {/* Notifications */}
          <button
            role="menuitem"
            onClick={() => navigateTo('/notifications')}
            className="w-full flex items-center gap-3 px-4 py-[10px]
                       transition-colors duration-100 cursor-pointer text-left"
            style={{ backgroundColor: 'transparent', border: 'none' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F9FAFB'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
            }}
          >
            <Bell size={16} color="#6B7280" aria-hidden="true" />
            <span
              style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize:   13,
                color:      '#374151',
              }}
            >
              Notifications
            </span>
          </button>

          {/* My Receipts */}
          <button
            role="menuitem"
            onClick={() => navigateTo('/account/receipts')}
            className="w-full flex items-center gap-3 px-4 py-[10px]
                       transition-colors duration-100 cursor-pointer text-left"
            style={{ backgroundColor: 'transparent', border: 'none' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F9FAFB'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
            }}
          >
            <Receipt size={16} color="#6B7280" aria-hidden="true" />
            <span
              style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize:   13,
                color:      '#374151',
              }}
            >
              My Receipts
            </span>
          </button>

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: '#F3F4F6' }} />

          {/* Sign Out */}
          <button
            role="menuitem"
            onClick={handleSignOut}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-3 px-4 py-[10px]
                       transition-colors duration-100 cursor-pointer text-left"
            style={{ backgroundColor: 'transparent', border: 'none' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FFF5F5'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
            }}
          >
            <LogOut size={16} color="#EF4444" aria-hidden="true" />
            <span
              style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize:   13,
                color:      '#EF4444',
                fontWeight: 500,
              }}
            >
              {isLoggingOut ? 'Signing out…' : 'Sign Out'}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}


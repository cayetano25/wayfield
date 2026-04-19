'use client'

import { useState, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { NotificationPanel } from './NotificationPanel'
import { useNotifications }  from '@/lib/hooks/useNotifications'

interface NotificationBellProps {
  isAuthenticated: boolean
}

export function NotificationBell({ isAuthenticated }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const {
    unreadCount,
    hasUrgentUnread,
    hasLeaderUnread,
    notifications,
    isLoading,
    hasLoaded,
    loadNotifications,
    markRead,
    markAllRead,
    markAllReadOnOpen,
    removeNotification,
  } = useNotifications(isAuthenticated)

  const badgeColor =
    hasUrgentUnread  ? '#EF4444' :   // red-500
    hasLeaderUnread  ? '#F97316' :   // orange-500
                       '#0FA3B1'     // teal-500 (organizer only)

  const handleOpen = useCallback(async () => {
    setIsOpen(true)
    await loadNotifications()
    return markAllReadOnOpen()
  }, [loadNotifications, markAllReadOnOpen])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  if (!isAuthenticated) return null

  return (
    <div style={{ position: 'relative' }}>

      {/* ── BELL BUTTON ─────────────────────────────────────────────────── */}
      <button
        onClick={isOpen ? handleClose : handleOpen}
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
            : 'Notifications, none unread'
        }
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        style={{
          position:        'relative',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          width:           36,
          height:          36,
          borderRadius:    8,
          border:          'none',
          backgroundColor: isOpen ? '#F0FDFF' : 'transparent',
          cursor:          'pointer',
          transition:      'background-color 150ms',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) (e.currentTarget as HTMLButtonElement)
            .style.backgroundColor = '#F9FAFB'
        }}
        onMouseLeave={(e) => {
          if (!isOpen) (e.currentTarget as HTMLButtonElement)
            .style.backgroundColor = 'transparent'
        }}
      >
        <Bell
          size={20}
          color={isOpen ? '#0FA3B1' : '#374151'}
          strokeWidth={1.75}
        />

        {/* ── BADGE ──────────────────────────────────────────────────────── */}
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position:        'absolute',
              top:             0,
              right:           0,
              width:           18,
              height:          18,
              borderRadius:    9999,
              backgroundColor: badgeColor,
              color:           '#ffffff',
              fontFamily:      'Plus Jakarta Sans, sans-serif',
              fontSize:        10,
              fontWeight:      700,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              lineHeight:      1,
              animation:       'badgePop 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              border:          '2px solid #ffffff',
            }}
          >
            {unreadCount >= 10 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── PANEL ───────────────────────────────────────────────────────── */}
      {isOpen && (
        <NotificationPanel
          notifications={notifications}
          isLoading={isLoading}
          hasLoaded={hasLoaded}
          onClose={handleClose}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onRemove={removeNotification}
        />
      )}

    </div>
  )
}

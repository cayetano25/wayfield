'use client'

import { useEffect, useRef } from 'react'
import { X, Bell, CheckCheck } from 'lucide-react'
import { NotificationItem } from './NotificationItem'
import type { AppNotification } from '@/lib/types/notifications'

interface NotificationPanelProps {
  notifications: AppNotification[]
  isLoading:     boolean
  hasLoaded:     boolean
  onClose:       () => void
  onMarkRead:    (recipientId: number) => void
  onMarkAllRead: () => void
  onRemove:      (recipientId: number) => void
}

export function NotificationPanel({
  notifications,
  isLoading,
  hasLoaded,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onRemove,
}: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div
      ref={panelRef}
      style={{
        position:        'absolute',
        top:             'calc(100% + 8px)',
        right:           0,
        width:           380,
        maxHeight:       520,
        backgroundColor: '#ffffff',
        border:          '1px solid #E5E7EB',
        borderRadius:    12,
        boxShadow:       '0 10px 25px rgba(0,0,0,0.12)',
        display:         'flex',
        flexDirection:   'column',
        overflow:        'hidden',
        zIndex:          200,
      }}
      role="dialog"
      aria-label="Notifications"
    >
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '14px 16px',
        borderBottom:   '1px solid #F3F4F6',
        flexShrink:     0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={16} color="#2E2E2E" />
          <span style={{
            fontFamily: 'Sora, sans-serif',
            fontSize:   15,
            fontWeight: 700,
            color:      '#2E2E2E',
          }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <span style={{
              fontFamily:      'Plus Jakarta Sans, sans-serif',
              fontSize:        11,
              fontWeight:      600,
              color:           '#ffffff',
              backgroundColor: '#0FA3B1',
              borderRadius:    9999,
              padding:         '1px 7px',
            }}>
              {unreadCount}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              title="Mark all as read"
              style={{
                display:         'flex',
                alignItems:      'center',
                gap:             4,
                padding:         '4px 10px',
                borderRadius:    6,
                border:          'none',
                backgroundColor: 'transparent',
                color:           '#0FA3B1',
                fontFamily:      'Plus Jakarta Sans, sans-serif',
                fontSize:        12,
                fontWeight:      500,
                cursor:          'pointer',
              }}
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close notifications"
            style={{
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              width:           28,
              height:          28,
              borderRadius:    6,
              border:          'none',
              backgroundColor: 'transparent',
              cursor:          'pointer',
              color:           '#9CA3AF',
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────── */}
      <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>

        {isLoading && !hasLoaded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                padding:         '16px',
                borderBottom:    '1px solid #F3F4F6',
                backgroundColor: '#ffffff',
              }}>
                <div style={{
                  height:          12,
                  width:           '60%',
                  backgroundColor: '#F3F4F6',
                  borderRadius:    4,
                  marginBottom:    8,
                }} />
                <div style={{
                  height:          10,
                  width:           '80%',
                  backgroundColor: '#F3F4F6',
                  borderRadius:    4,
                }} />
              </div>
            ))}
          </div>
        )}

        {hasLoaded && notifications.length === 0 && (
          <div style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '48px 24px',
            gap:            12,
          }}>
            <Bell size={32} color="#D1D5DB" />
            <p style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize:   14,
              color:      '#9CA3AF',
              margin:     0,
              textAlign:  'center',
            }}>
              You&apos;re all caught up!
            </p>
          </div>
        )}

        {notifications.map(n => (
          <NotificationItem
            key={n.recipient_id}
            notification={n}
            onMarkRead={onMarkRead}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  )
}

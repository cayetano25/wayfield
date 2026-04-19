'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchUnreadCount,
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/api/notifications'
import type { AppNotification, UnreadMeta } from '@/lib/types/notifications'

const POLL_INTERVAL_MS = 30_000
const EMPTY_META: UnreadMeta = { unread_count: 0, has_urgent_unread: false, has_leader_unread: false }

export function useNotifications(isAuthenticated: boolean) {
  const [unreadMeta, setUnreadMeta]       = useState<UnreadMeta>(EMPTY_META)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isLoading, setIsLoading]         = useState(false)
  const [hasLoaded, setHasLoaded]         = useState(false)
  const pollRef                           = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  // ── Poll the unread count (badges) ───────────────────────────────────
  const refreshCount = useCallback(async () => {
    if (!isAuthenticated) return
    const meta = await fetchUnreadCount()
    setUnreadMeta(meta)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadMeta(EMPTY_META)
      return
    }
    refreshCount()
    pollRef.current = setInterval(refreshCount, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isAuthenticated, refreshCount])

  // ── Load full notification list ───────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated || isLoading) return
    setIsLoading(true)
    try {
      const res = await fetchNotifications(1)
      setNotifications(res.data)
      setHasLoaded(true)
      // Seed priority flags from list meta when available
      if (res.meta) {
        setUnreadMeta({
          unread_count:      res.meta.unread_count      ?? 0,
          has_urgent_unread: res.meta.has_urgent_unread ?? false,
          has_leader_unread: res.meta.has_leader_unread ?? false,
        })
      }
    } catch {
      // Silently fail — show empty state
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, isLoading])

  // ── Mark one as read ──────────────────────────────────────────────────
  const markRead = useCallback(async (recipientId: number) => {
    setNotifications(prev =>
      prev.map(n =>
        n.recipient_id === recipientId
          ? { ...n, is_read: true, read_at: new Date().toISOString() }
          : n
      )
    )
    // Decrement count; urgency/leader flags corrected on next poll
    setUnreadMeta(prev => ({ ...prev, unread_count: Math.max(0, prev.unread_count - 1) }))
    await markNotificationRead(recipientId)
    refreshCount()
  }, [refreshCount])

  // ── Mark all as read ──────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    )
    setUnreadMeta(EMPTY_META)
    await markAllNotificationsRead()
  }, [])

  // ── Mark all read after panel opens (with 2s delay) ───────────────────
  const markAllReadOnOpen = useCallback(() => {
    const timer = setTimeout(async () => {
      if (notifications.some(n => !n.is_read)) {
        await markAllRead()
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [notifications, markAllRead])

  // ── Remove a notification from the list ───────────────────────────────
  const removeNotification = useCallback((recipientId: number) => {
    setNotifications(prev => prev.filter(n => n.recipient_id !== recipientId))
    setUnreadMeta(prev => ({ ...prev, unread_count: Math.max(0, prev.unread_count - 1) }))
  }, [])

  return {
    unreadCount:      unreadMeta.unread_count,
    hasUrgentUnread:  unreadMeta.has_urgent_unread,
    hasLeaderUnread:  unreadMeta.has_leader_unread,
    notifications,
    isLoading,
    hasLoaded,
    loadNotifications,
    markRead,
    markAllRead,
    markAllReadOnOpen,
    removeNotification,
    refreshCount,
  }
}

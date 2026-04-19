import { apiGet, apiPatch, apiPost } from './client'
import type { NotificationsResponse, UnreadMeta } from '@/lib/types/notifications'

const EMPTY_META: UnreadMeta = { unread_count: 0, has_urgent_unread: false, has_leader_unread: false }

export async function fetchUnreadCount(): Promise<UnreadMeta> {
  try {
    const data = await apiGet<Partial<UnreadMeta>>('/me/notifications/unread-count')
    return {
      unread_count:      data.unread_count      ?? 0,
      has_urgent_unread: data.has_urgent_unread ?? false,
      has_leader_unread: data.has_leader_unread ?? false,
    }
  } catch {
    return EMPTY_META
  }
}

export async function fetchNotifications(page = 1): Promise<NotificationsResponse> {
  return apiGet<NotificationsResponse>(`/me/notifications?page=${page}`)
}

export async function markNotificationRead(recipientId: number): Promise<void> {
  await apiPatch<void>(`/me/notifications/${recipientId}/read`)
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiPost<void>('/me/notifications/read-all')
}

export async function acceptLeaderInvitation(token: string): Promise<boolean> {
  try {
    await apiPost<void>(`/leader-invitations/${token}/accept`)
    return true
  } catch {
    return false
  }
}

export async function declineLeaderInvitation(token: string): Promise<boolean> {
  try {
    await apiPost<void>(`/leader-invitations/${token}/decline`)
    return true
  } catch {
    return false
  }
}

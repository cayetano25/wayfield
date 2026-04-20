'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import {
  acceptLeaderInvitation,
  declineLeaderInvitation,
  acceptOrgInvitation,
  declineOrgInvitation,
} from '@/lib/api/notifications'
import { clearNavCache } from '@/lib/hooks/useNavContext'
import type { AppNotification, OrgInvitationActionData, LeaderInvitationActionData } from '@/lib/types/notifications'

const ROLE_LABELS: Record<string, string> = {
  owner:         'Owner',
  admin:         'Administrator',
  staff:         'Staff',
  billing_admin: 'Billing Administrator',
}

interface NotificationItemProps {
  notification: AppNotification
  onMarkRead:   (recipientId: number) => void
  onRemove:     (recipientId: number) => void
}

export function NotificationItem({
  notification: n,
  onMarkRead,
  onRemove,
}: NotificationItemProps) {
  const [actionState, setActionState] = useState<
    'idle' | 'accepting' | 'declining' | 'accepted' | 'declined' | 'error'
  >('idle')

  function handleClick() {
    if (!n.is_read && !n.is_invitation) {
      onMarkRead(n.recipient_id)
    }
  }

  const isOrgInvite = n.action_data?.type === 'org_invitation'
  const orgData     = isOrgInvite ? (n.action_data as OrgInvitationActionData) : null

  async function handleAccept() {
    if (!n.action_data) return
    setActionState('accepting')
    const ok = isOrgInvite
      ? await acceptOrgInvitation((n.action_data as OrgInvitationActionData).invitation_token)
      : await acceptLeaderInvitation((n.action_data as LeaderInvitationActionData).accept_token)
    if (ok) {
      if (isOrgInvite) clearNavCache()
      setActionState('accepted')
      setTimeout(() => onRemove(n.recipient_id), 1800)
    } else {
      setActionState('error')
      setTimeout(() => setActionState('idle'), 3000)
    }
  }

  async function handleDecline() {
    if (!n.action_data) return
    setActionState('declining')
    const ok = isOrgInvite
      ? await declineOrgInvitation((n.action_data as OrgInvitationActionData).invitation_token)
      : await declineLeaderInvitation((n.action_data as LeaderInvitationActionData).decline_token)
    if (ok) {
      setActionState('declined')
      setTimeout(() => onRemove(n.recipient_id), 1800)
    } else {
      setActionState('error')
      setTimeout(() => setActionState('idle'), 3000)
    }
  }

  const timeAgo = formatTimeAgo(n.created_at)
  const rowBg   = n.is_read ? '#ffffff' : '#F8FFFE'

  return (
    <div
      onClick={handleClick}
      style={{
        padding:         '14px 16px',
        borderBottom:    '1px solid #F3F4F6',
        backgroundColor: rowBg,
        cursor:          n.is_invitation ? 'default' : 'pointer',
        transition:      'background-color 150ms',
        position:        'relative',
      }}
    >
      {/* Unread dot */}
      {!n.is_read && (
        <span
          style={{
            position:        'absolute',
            top:             18,
            left:            6,
            width:           6,
            height:          6,
            borderRadius:    '50%',
            backgroundColor: '#0FA3B1',
          }}
          aria-label="Unread"
        />
      )}

      <div style={{ paddingLeft: n.is_read ? 0 : 8 }}>
        {/* Title + time */}
        <div style={{ display: 'flex', justifyContent: 'space-between',
                      alignItems: 'flex-start', gap: 8 }}>
          <p style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize:   13,
            fontWeight: n.is_read ? 400 : 600,
            color:      '#2E2E2E',
            margin:     0,
            lineHeight: 1.4,
          }}>
            {n.title}
          </p>
          <span style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize:   11,
            color:      '#9CA3AF',
            flexShrink: 0,
            marginTop:  1,
          }}>
            {timeAgo}
          </span>
        </div>

        {/* Message */}
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize:   12,
          color:      '#6B7280',
          margin:     '4px 0 0',
          lineHeight: 1.5,
        }}>
          {n.message}
        </p>

        {/* ── ORG INVITATION CONTEXT LINES ──────────────────────────── */}
        {n.is_invitation && isOrgInvite && orgData && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize:   11,
              color:      '#6B7280',
            }}>
              From <strong style={{ color: '#374151' }}>{orgData.organization_name}</strong>
            </span>
            <span style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize:   11,
              color:      '#6B7280',
            }}>
              Invited as: <strong style={{ color: '#374151' }}>
                {ROLE_LABELS[orgData.role] ?? orgData.role}
              </strong>
            </span>
          </div>
        )}

        {/* ── INVITATION ACTION BUTTONS ──────────────────────────────── */}
        {n.is_invitation && n.action_data && (
          <div style={{ marginTop: 12 }}>

            {actionState === 'idle' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleAccept() }}
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             6,
                    padding:         '6px 14px',
                    borderRadius:    6,
                    border:          'none',
                    backgroundColor: '#0FA3B1',
                    color:           '#ffffff',
                    fontFamily:      'Plus Jakarta Sans, sans-serif',
                    fontSize:        12,
                    fontWeight:      600,
                    cursor:          'pointer',
                    transition:      'background-color 150ms',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0891B2'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0FA3B1'
                  }}
                >
                  <CheckCircle size={13} />
                  Accept
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); handleDecline() }}
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             6,
                    padding:         '6px 14px',
                    borderRadius:    6,
                    border:          '1px solid #E5E7EB',
                    backgroundColor: '#ffffff',
                    color:           '#374151',
                    fontFamily:      'Plus Jakarta Sans, sans-serif',
                    fontSize:        12,
                    fontWeight:      500,
                    cursor:          'pointer',
                    transition:      'background-color 150ms',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F9FAFB'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ffffff'
                  }}
                >
                  <XCircle size={13} />
                  Decline
                </button>
              </div>
            )}

            {(actionState === 'accepting' || actionState === 'declining') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                            color: '#6B7280' }}>
                <Loader2 size={14} className="animate-spin" />
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12 }}>
                  {actionState === 'accepting' ? 'Accepting…' : 'Declining…'}
                </span>
              </div>
            )}

            {actionState === 'accepted' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                            color: '#10B981' }}>
                <CheckCircle size={14} />
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif',
                               fontSize: 12, fontWeight: 600 }}>
                  {isOrgInvite
                    ? `Joined ${orgData?.organization_name ?? 'the organization'}!`
                    : 'Invitation accepted! Check My Sessions.'}
                </span>
              </div>
            )}

            {actionState === 'declined' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8,
                            color: '#9CA3AF' }}>
                <XCircle size={14} />
                <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12 }}>
                  Invitation declined.
                </span>
              </div>
            )}

            {actionState === 'error' && (
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif',
                          fontSize: 12, color: '#EF4444', margin: 0 }}>
                Something went wrong. Try using the email link instead.
              </p>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

function formatTimeAgo(isoString: string): string {
  const date  = new Date(isoString)
  const now   = new Date()
  const diffS = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffS < 60)         return 'just now'
  if (diffS < 3600)       return `${Math.floor(diffS / 60)}m ago`
  if (diffS < 86400)      return `${Math.floor(diffS / 3600)}h ago`
  if (diffS < 86400 * 7)  return `${Math.floor(diffS / 86400)}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

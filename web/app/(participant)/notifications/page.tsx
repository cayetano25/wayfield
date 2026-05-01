'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, Bell, Building2, Check, CheckCheck, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { apiGet, apiPatch } from '@/lib/api/client';
import { acceptOrgInvitation, declineOrgInvitation } from '@/lib/api/notifications';
import { Button } from '@/components/ui/Button';
import type { ParticipantNotification, NotificationSender, OrgInvitationAction } from '@/lib/types/notifications';

interface RawApiNotification {
  recipient_id:      number;
  notification_id:   number;
  title:             string;
  message:           string;
  notification_type: 'informational' | 'urgent' | 'reminder';
  sender_scope?:     'organizer' | 'leader';
  sender:            NotificationSender;
  session_context:   ParticipantNotification['session_context'];
  workshop_context:  ParticipantNotification['workshop_context'];
  is_read:           boolean;
  read_at:           string | null;
  created_at:        string;
  is_invitation:     boolean;
  invitation_action: OrgInvitationAction | null;
}

interface ApiResponse {
  data: RawApiNotification[];
  meta: { total: number; current_page: number; last_page: number };
}

/* --- Helpers ----------------------------------------------------------- */

function formatTimeAgo(isoString: string): string {
  const diffS = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffS < 60)        return 'just now';
  if (diffS < 3600)      return `${Math.floor(diffS / 60)}m ago`;
  if (diffS < 86400)     return `${Math.floor(diffS / 3600)}h ago`;
  const diffD = Math.floor(diffS / 86400);
  if (diffD === 1)       return 'Yesterday';
  if (diffD < 7)         return `${diffD}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatSessionTime(isoString: string, timezone: string): string {
  const date = new Date(isoString);
  const tz   = { timeZone: timezone };
  const day  = new Intl.DateTimeFormat('en-US', { ...tz, weekday: 'short' }).format(date);
  const md   = new Intl.DateTimeFormat('en-US', { ...tz, month: 'short', day: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat('en-US', { ...tz, hour: 'numeric', minute: '2-digit' }).format(date);
  return `${day} ${md} · ${time}`;
}

function formatFullDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (!isFinite(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(d);
}

const ROLE_LABELS: Record<string, string> = {
  owner:         'Owner',
  admin:         'Administrator',
  staff:         'Staff Member',
  billing_admin: 'Billing Administrator',
};

/* --- Type badge config ------------------------------------------------- */

const TYPE_BADGE = {
  informational: { label: 'Info',     bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE', bold: false },
  urgent:        { label: 'Urgent',   bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', bold: true  },
  reminder:      { label: 'Reminder', bg: '#FFF7ED', color: '#EA580C', border: '#FED7AA', bold: false },
} as const;

/* --- Avatar ------------------------------------------------------------ */

function Avatar({ sender, size }: { sender: NotificationSender; size: number }) {
  const iconSize = Math.round(size * 0.44);

  if (sender.type === 'organizer') {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        backgroundColor: '#CCFBF1', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Building2 size={iconSize} color="#0FA3B1" />
      </div>
    );
  }

  if (sender.profile_image_url) {
    return (
      <Image
        src={sender.profile_image_url}
        alt={sender.display_label}
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }

  const initials = `${sender.first_name.charAt(0)}${sender.last_name.charAt(0)}`.toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      backgroundColor: '#FFEDD5', color: '#C2410C',
      fontSize: Math.round(size * 0.33), fontWeight: 700,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {initials}
    </div>
  );
}

/* --- Notification row -------------------------------------------------- */

function NotificationCard({
  notification: n,
  onMarkRead,
}: {
  notification: ParticipantNotification;
  onMarkRead: (id: number) => void;
}) {
  const [expanded,     setExpanded]     = useState(false);
  const [hovered,      setHovered]      = useState(false);
  const [actionState,  setActionState]  = useState<
    'idle' | 'accepting' | 'declining' | 'accepted' | 'declined' | 'error'
  >('idle');

  const isLeader     = n.sender_scope === 'leader';
  const isUnread     = !n.read_at;
  const isUrgent     = n.notification_type === 'urgent';
  const isInvitation = n.is_invitation && !!n.invitation_action;
  const accent       = isLeader ? '#E67E22' : '#0FA3B1';
  const dot          = isLeader ? '#E67E22' : '#0FA3B1';
  const badge        = TYPE_BADGE[n.notification_type] ?? TYPE_BADGE.informational;

  function handleClick() {
    setExpanded(prev => !prev);
    if (isUnread && !isInvitation) onMarkRead(n.id);
  }

  async function handleAccept() {
    if (!n.invitation_action) return;
    setActionState('accepting');
    const ok = await acceptOrgInvitation(n.invitation_action.token);
    if (ok) {
      setActionState('accepted');
      onMarkRead(n.id);
    } else {
      setActionState('error');
      setTimeout(() => setActionState('idle'), 3000);
    }
  }

  async function handleDecline() {
    if (!n.invitation_action) return;
    setActionState('declining');
    const ok = await declineOrgInvitation(n.invitation_action.token);
    if (ok) {
      setActionState('declined');
      onMarkRead(n.id);
    } else {
      setActionState('error');
      setTimeout(() => setActionState('idle'), 3000);
    }
  }

  const senderLine = n.sender.type === 'leader'
    ? `From ${n.sender.first_name} ${n.sender.last_name} · Session Leader`
    : `From ${n.sender.name}`;

  const contextColor = isLeader ? '#D97706' : '#0FA3B1';

  // Left padding of expanded area aligns under text content
  const detailPadLeft = 3 + 12 + 36 + 12; // accent + leftGap + avatar + rightGap

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius:    12,
      border:          `1px solid ${isUnread ? (isLeader ? '#FDE68A' : '#99F6E4') : '#E5E7EB'}`,
      overflow:        'hidden',
      boxShadow:       isUnread ? '0 1px 6px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.04)',
      transition:      'box-shadow 150ms, border-color 150ms',
    }}>
      {/* ── ROW ─────────────────────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display:         'flex',
          minHeight:       72,
          cursor:          'pointer',
          backgroundColor: hovered ? '#F9FAFB' : (isUnread ? '#FDFFFE' : '#ffffff'),
          transition:      'background-color 150ms',
          outline:         'none',
        }}
      >
        {/* Left accent bar */}
        <div style={{
          width:           3,
          alignSelf:       'stretch',
          flexShrink:      0,
          backgroundColor: accent,
          opacity:         isUnread ? 1 : 0.5,
        }} />

        {/* Avatar */}
        <div style={{ padding: '16px 0 16px 12px', alignSelf: 'flex-start', flexShrink: 0 }}>
          <Avatar sender={n.sender} size={36} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, padding: '12px 16px 12px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Title + badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {isUnread && (
                  <span style={{
                    display:         'inline-block',
                    width:           8,
                    height:          8,
                    borderRadius:    '50%',
                    backgroundColor: dot,
                    flexShrink:      0,
                  }} />
                )}
                <span style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize:   13,
                  fontWeight: isUnread ? 600 : 400,
                  color:      '#2E2E2E',
                  lineHeight: 1.4,
                }}>
                  {n.title}
                </span>
                <span style={{
                  fontFamily:      'Plus Jakarta Sans, sans-serif',
                  fontSize:        11,
                  fontWeight:      badge.bold ? 600 : 500,
                  color:           badge.color,
                  backgroundColor: badge.bg,
                  border:          `1px solid ${badge.border}`,
                  borderRadius:    9999,
                  padding:         '1px 7px',
                  flexShrink:      0,
                  lineHeight:      1.6,
                }}>
                  {badge.label}
                </span>
              </div>

              {/* Sender */}
              <p style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize:   11,
                color:      '#6B7280',
                margin:     '3px 0 0',
                lineHeight: 1.4,
              }}>
                {senderLine}
              </p>

              {/* Context */}
              {n.session_context ? (
                <p style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize:   11,
                  color:      contextColor,
                  margin:     '2px 0 0',
                  lineHeight: 1.4,
                }}>
                  Session: {n.session_context.session_title} · {formatSessionTime(n.session_context.start_at, n.session_context.workshop_timezone)}
                </p>
              ) : n.workshop_context ? (
                <p style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize:   11,
                  color:      '#9CA3AF',
                  margin:     '2px 0 0',
                  lineHeight: 1.4,
                }}>
                  Workshop: {n.workshop_context.workshop_title}
                </p>
              ) : null}

              {/* Message preview */}
              {!expanded && (
                <p
                  className="line-clamp-2"
                  style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize:   12,
                    color:      '#6B7280',
                    margin:     '6px 0 0',
                    lineHeight: 1.5,
                  }}
                >
                  {n.message}
                </p>
              )}
            </div>

            {/* Timestamp */}
            <span style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize:   11,
              color:      '#9CA3AF',
              flexShrink: 0,
              marginTop:  2,
            }}>
              {formatTimeAgo(n.sent_at)}
            </span>
          </div>
        </div>
      </div>

      {/* ── EXPANDED DETAIL ─────────────────────────────────────────────── */}
      {expanded && (
        <div style={{
          paddingLeft:     detailPadLeft,
          paddingRight:    16,
          paddingBottom:   20,
          borderTop:       '1px solid #F3F4F6',
          backgroundColor: '#FAFAFA',
        }}>
          {/* Detail header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0 12px' }}>
            <Avatar sender={n.sender} size={48} />
            <div>
              <p style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize:   14,
                fontWeight: 600,
                color:      '#2E2E2E',
                margin:     0,
                lineHeight: 1.3,
              }}>
                {n.sender.display_label}
              </p>
              <p style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize:   12,
                color:      '#9CA3AF',
                margin:     '2px 0 0',
              }}>
                {formatFullDateTime(n.sent_at)}
              </p>
            </div>
          </div>

          {/* Urgent banner */}
          {isUrgent && (
            <div style={{
              backgroundColor: '#FEF2F2',
              border:          '1px solid #FECACA',
              color:           '#B91C1C',
              borderRadius:    8,
              padding:         '10px 12px',
              marginBottom:    12,
              fontFamily:      'Plus Jakarta Sans, sans-serif',
              fontSize:        13,
              lineHeight:      1.4,
            }}>
              ⚠ Urgent message from {n.sender.display_label}
            </div>
          )}

          {/* Session / workshop context block */}
          <div style={{
            backgroundColor: '#ffffff',
            border:          '1px solid #E5E7EB',
            borderRadius:    8,
            padding:         '10px 12px',
            marginBottom:    12,
          }}>
            {n.session_context ? (
              <>
                <p style={{
                  fontFamily:    'Plus Jakarta Sans, sans-serif',
                  fontSize:      10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color:         '#9CA3AF',
                  margin:        '0 0 4px',
                }}>
                  Session
                </p>
                <p style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize:   14,
                  fontWeight: 600,
                  color:      '#2E2E2E',
                  margin:     0,
                }}>
                  {n.session_context.session_title}
                </p>
                <p style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize:   12,
                  color:      '#6B7280',
                  margin:     '3px 0 0',
                }}>
                  {formatSessionTime(n.session_context.start_at, n.session_context.workshop_timezone)}
                </p>
              </>
            ) : n.workshop_context ? (
              <>
                <p style={{
                  fontFamily:    'Plus Jakarta Sans, sans-serif',
                  fontSize:      10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color:         '#9CA3AF',
                  margin:        '0 0 4px',
                }}>
                  Workshop
                </p>
                <p style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize:   14,
                  fontWeight: 600,
                  color:      '#2E2E2E',
                  margin:     0,
                }}>
                  {n.workshop_context.workshop_title}
                </p>
              </>
            ) : null}
          </div>

          {/* Full message */}
          <p style={{
            fontFamily:  'Plus Jakarta Sans, sans-serif',
            fontSize:    14,
            color:       '#374151',
            lineHeight:  1.6,
            margin:      0,
            whiteSpace:  'pre-wrap',
          }}>
            {n.message}
          </p>

          {/* ── INVITATION ACTIONS ──────────────────────────────────────── */}
          {isInvitation && n.invitation_action && (
            <div style={{ marginTop: 16 }}>
              {n.invitation_action.organization_name && (
                <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: '#6B7280' }}>
                    Organisation: <strong style={{ color: '#2E2E2E' }}>{n.invitation_action.organization_name}</strong>
                  </span>
                  {n.invitation_action.role && (
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: '#6B7280' }}>
                      Role: <strong style={{ color: '#2E2E2E' }}>{ROLE_LABELS[n.invitation_action.role] ?? n.invitation_action.role}</strong>
                    </span>
                  )}
                </div>
              )}

              {actionState === 'idle' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAccept(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 16px', borderRadius: 6, border: 'none',
                      backgroundColor: '#0FA3B1', color: '#ffffff',
                      fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', transition: 'background-color 150ms',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0891B2'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0FA3B1'; }}
                  >
                    <CheckCircle size={14} />
                    Accept
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDecline(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 16px', borderRadius: 6, border: '1px solid #E5E7EB',
                      backgroundColor: '#ffffff', color: '#374151',
                      fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 500,
                      cursor: 'pointer', transition: 'background-color 150ms',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F9FAFB'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ffffff'; }}
                  >
                    <XCircle size={14} />
                    Decline
                  </button>
                </div>
              )}

              {(actionState === 'accepting' || actionState === 'declining') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6B7280' }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13 }}>
                    {actionState === 'accepting' ? 'Accepting…' : 'Declining…'}
                  </span>
                </div>
              )}

              {actionState === 'accepted' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10B981' }}>
                  <CheckCircle size={14} />
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600 }}>
                    Joined {n.invitation_action.organization_name ?? 'the organisation'}!
                  </span>
                </div>
              )}

              {actionState === 'declined' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF' }}>
                  <XCircle size={14} />
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13 }}>
                    Invitation declined.
                  </span>
                </div>
              )}

              {actionState === 'error' && (
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: '#EF4444', margin: 0 }}>
                  Something went wrong. Try using the email link instead.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* --- Skeleton ---------------------------------------------------------- */

function Skeleton() {
  return (
    <div style={{
      display:         'flex',
      minHeight:       72,
      backgroundColor: '#ffffff',
      borderRadius:    12,
      border:          '1px solid #E5E7EB',
      overflow:        'hidden',
    }}>
      <div style={{ width: 3, backgroundColor: '#E5E7EB', flexShrink: 0 }} />
      <div style={{ padding: '16px 0 16px 12px', flexShrink: 0 }}>
        <div className="animate-pulse" style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#E5E7EB' }} />
      </div>
      <div style={{ flex: 1, padding: '12px 16px 12px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div className="animate-pulse" style={{ height: 13, width: '55%', backgroundColor: '#E5E7EB', borderRadius: 4 }} />
        <div className="animate-pulse" style={{ height: 11, width: '35%', backgroundColor: '#E5E7EB', borderRadius: 4 }} />
        <div className="animate-pulse" style={{ height: 11, width: '75%', backgroundColor: '#E5E7EB', borderRadius: 4 }} />
      </div>
    </div>
  );
}

/* --- Empty state ------------------------------------------------------- */

function EmptyState() {
  return (
    <div style={{
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      textAlign:       'center',
      backgroundColor: '#ffffff',
      borderRadius:    12,
      padding:         '64px 32px',
      boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        width:           56,
        height:          56,
        borderRadius:    '50%',
        backgroundColor: '#F3F4F6',
        border:          '1px solid #E5E7EB',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        marginBottom:    16,
      }}>
        <Bell className="w-6 h-6" style={{ color: '#9CA3AF' }} />
      </div>
      <h2 className="font-heading font-semibold" style={{ fontSize: 16, color: '#2E2E2E', marginBottom: 4 }}>
        No notifications yet
      </h2>
      <p className="font-sans" style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>
        Updates from your workshop organizer will appear here.
      </p>
    </div>
  );
}

/* --- Page -------------------------------------------------------------- */

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<ParticipantNotification[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(false);
  const [markingAll,    setMarkingAll]    = useState(false);

  const fetchNotifications = useCallback(() => {
    setLoading(true);
    setError(false);
    apiGet<ApiResponse>('/me/notifications')
      .then((res) => {
        const mapped: ParticipantNotification[] = (res.data ?? []).map((r) => ({
          id:                r.recipient_id,
          notification_id:   r.notification_id,
          title:             r.title,
          message:           r.message,
          notification_type: r.notification_type,
          sender_scope:      r.sender_scope ?? 'organizer',
          sender:            r.sender,
          session_context:   r.session_context,
          workshop_context:  r.workshop_context,
          in_app_status:     r.is_read ? 'read' : 'pending',
          read_at:           r.read_at,
          sent_at:           r.created_at,
          is_invitation:     r.is_invitation ?? false,
          invitation_action: r.invitation_action ?? null,
        }));
        setNotifications(mapped);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  function handleMarkRead(id: number) {
    if (!id) return;
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString(), in_app_status: 'read' as const } : n,
      ),
    );
    apiPatch(`/me/notifications/${id}/read`, {}).catch(() => {/* silent — state already updated optimistically */});
  }

  async function handleMarkAllRead() {
    const unread = notifications.filter((n) => !n.read_at);
    if (unread.length === 0) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: now, in_app_status: 'read' as const })),
    );
    try {
      await Promise.all(unread.map((n) => apiPatch(`/me/notifications/${n.id}/read`, {})));
    } catch {
      fetchNotifications();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="mx-auto" style={{ maxWidth: 1200, padding: '32px 24px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="font-heading font-bold" style={{ fontSize: 22, color: '#2E2E2E' }}>
            Notifications
          </h1>
          {!loading && unreadCount > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-white font-semibold"
              style={{ fontSize: 11, backgroundColor: '#0FA3B1' }}
            >
              {unreadCount}
            </span>
          )}
        </div>

        {!loading && unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={handleMarkAllRead} loading={markingAll}>
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </Button>
        )}

        {!loading && unreadCount === 0 && notifications.length > 0 && (
          <div className="flex items-center gap-1.5" style={{ color: '#9CA3AF' }}>
            <Check className="w-4 h-4" />
            <span className="font-sans text-sm">All caught up</span>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : error ? (
        <div
          className="bg-white flex flex-col items-center text-center gap-4"
          style={{ borderRadius: 12, padding: '48px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
        >
          <AlertCircle className="w-10 h-10" style={{ color: '#E94F37' }} />
          <div>
            <p className="font-heading font-semibold mb-1" style={{ color: '#2E2E2E' }}>
              Unable to load notifications.
            </p>
            <p className="font-sans text-sm" style={{ color: '#6B7280' }}>
              Please try again.
            </p>
          </div>
          <Button variant="secondary" onClick={fetchNotifications}>
            Retry
          </Button>
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifications.map((n, i) => (
            <NotificationCard key={n.id ?? i} notification={n} onMarkRead={handleMarkRead} />
          ))}
        </div>
      )}
    </div>
  );
}

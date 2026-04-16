'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, AlertCircle, Info, Clock, Check, CheckCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { apiGet, apiPatch } from '@/lib/api/client';
import { Button } from '@/components/ui/Button';

/* ─── Types ────────────────────────────────────────────────────────────── */

type NotificationType = 'informational' | 'urgent' | 'reminder';

interface ParticipantNotification {
  id: number;
  notification_id: number;
  in_app_status: 'pending' | 'delivered' | 'read';
  read_at: string | null;
  title: string;
  message: string;
  notification_type: NotificationType;
  workshop_id: number;
  session_id: number | null;
  sent_at: string | null;
  created_at: string;
}

interface ApiResponse {
  data: ParticipantNotification[];
  meta: { total: number; current_page: number; last_page: number };
}

/* ─── Type badge config ────────────────────────────────────────────────── */

const typeConfig: Record<
  NotificationType,
  { label: string; icon: React.ReactNode; badgeClass: string; dotClass: string }
> = {
  informational: {
    label: 'Info',
    icon: <Info className="w-3 h-3" />,
    badgeClass: 'bg-[#7EA8BE]/15 text-[#4A7A96] border border-[#7EA8BE]/30',
    dotClass: 'bg-[#7EA8BE]',
  },
  urgent: {
    label: 'Urgent',
    icon: <AlertCircle className="w-3 h-3" />,
    badgeClass: 'bg-[#E94F37]/10 text-[#E94F37] border border-[#E94F37]/25',
    dotClass: 'bg-[#E94F37]',
  },
  reminder: {
    label: 'Reminder',
    icon: <Clock className="w-3 h-3" />,
    badgeClass: 'bg-[#E67E22]/10 text-[#E67E22] border border-[#E67E22]/25',
    dotClass: 'bg-[#E67E22]',
  },
};

/* ─── Notification card ────────────────────────────────────────────────── */

function NotificationCard({
  notification,
  onMarkRead,
}: {
  notification: ParticipantNotification;
  onMarkRead: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isUnread = !notification.read_at;
  const cfg = typeConfig[notification.notification_type] ?? typeConfig.informational;

  const timestamp = notification.sent_at ?? notification.created_at;

  function handleToggle() {
    setExpanded((prev) => !prev);
    if (isUnread) {
      onMarkRead(notification.id);
    }
  }

  return (
    <div
      className="bg-white rounded-xl overflow-hidden transition-shadow"
      style={{
        boxShadow: isUnread
          ? '0 2px 12px rgba(15,163,177,0.10), 0 1px 4px rgba(0,0,0,0.06)'
          : '0 1px 4px rgba(0,0,0,0.06)',
        border: isUnread ? '1.5px solid rgba(15,163,177,0.25)' : '1px solid #E5E7EB',
      }}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="w-full text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-3 px-5 py-4">
          {/* Unread dot */}
          <div className="shrink-0 mt-1.5">
            {isUnread ? (
              <span
                className="block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: '#0FA3B1' }}
              />
            ) : (
              <span className="block w-2.5 h-2.5 rounded-full bg-transparent" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {/* Type badge */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.badgeClass}`}
              >
                {cfg.icon}
                {cfg.label}
              </span>

              {/* Timestamp */}
              <span className="text-[11px]" style={{ color: '#9CA3AF' }}>
                {formatDistanceToNow(parseISO(timestamp), { addSuffix: true })}
              </span>
            </div>

            <p
              className="font-heading font-semibold leading-snug"
              style={{ fontSize: 15, color: isUnread ? '#2E2E2E' : '#374151' }}
            >
              {notification.title}
            </p>

            {/* Preview line when collapsed */}
            {!expanded && (
              <p
                className="font-sans mt-1 line-clamp-2 leading-relaxed"
                style={{ fontSize: 13, color: '#6B7280' }}
              >
                {notification.message}
              </p>
            )}
          </div>

          {/* Expand indicator */}
          <div className="shrink-0 mt-1" style={{ color: '#9CA3AF' }}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div
          className="px-5 pb-5"
          style={{ paddingLeft: 'calc(20px + 10px + 12px)' }} // align under content (px-5 + dot-width + gap)
        >
          <div
            className="rounded-lg p-4"
            style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
          >
            <p className="font-sans leading-relaxed whitespace-pre-wrap" style={{ fontSize: 14, color: '#374151' }}>
              {notification.message}
            </p>
          </div>

          {notification.session_id && (
            <p className="font-sans mt-2.5 text-xs" style={{ color: '#9CA3AF' }}>
              Sent for a specific session
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Empty state ──────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div
      className="bg-white flex flex-col items-center text-center"
      style={{ borderRadius: 12, padding: '64px 32px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      <div
        className="flex items-center justify-center mb-4"
        style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB' }}
      >
        <Bell className="w-6 h-6" style={{ color: '#9CA3AF' }} />
      </div>
      <h2 className="font-heading font-semibold mb-1" style={{ fontSize: 16, color: '#2E2E2E' }}>
        No notifications yet
      </h2>
      <p className="font-sans" style={{ fontSize: 14, color: '#6B7280' }}>
        Workshop updates and announcements will appear here.
      </p>
    </div>
  );
}

/* ─── Skeleton ─────────────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div
      className="bg-white rounded-xl"
      style={{
        height: 88,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        border: '1px solid #E5E7EB',
        background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
        backgroundSize: '400% 100%',
        animation: 'notifShimmer 1.4s infinite',
      }}
    />
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<ParticipantNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(() => {
    setLoading(true);
    setError(false);
    apiGet<ApiResponse>('/me/notifications')
      .then((res) => setNotifications(res.data ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  function handleMarkRead(recipientId: number) {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === recipientId ? { ...n, read_at: new Date().toISOString(), in_app_status: 'read' as const } : n,
      ),
    );
    apiPatch(`/me/notifications/${recipientId}/read`, {}).catch(() => {
      // Revert on failure (re-fetch)
      fetchNotifications();
    });
  }

  async function handleMarkAllRead() {
    const unread = notifications.filter((n) => !n.read_at);
    if (unread.length === 0) return;
    setMarkingAll(true);

    // Optimistic update
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: now, in_app_status: 'read' as const })),
    );

    try {
      await Promise.all(
        unread.map((n) => apiPatch(`/me/notifications/${n.id}/read`, {})),
      );
    } catch {
      fetchNotifications();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes notifShimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
      `}</style>

      <div className="mx-auto" style={{ maxWidth: 720, padding: '32px 16px' }}>
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
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllRead}
              loading={markingAll}
            >
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
          <div className="flex flex-col gap-3">
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
                Could not load notifications
              </p>
              <p className="font-sans text-sm" style={{ color: '#6B7280' }}>
                Check your connection and try again.
              </p>
            </div>
            <Button variant="secondary" onClick={fetchNotifications}>
              Retry
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((n) => (
              <NotificationCard
                key={n.id}
                notification={n}
                onMarkRead={handleMarkRead}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

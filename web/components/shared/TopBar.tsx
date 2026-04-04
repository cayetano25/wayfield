'use client';

import Link from 'next/link';
import { Bell, Megaphone, ChevronRight, CheckCheck } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { usePage } from '@/contexts/PageContext';
import { useEffect, useRef, useState, useCallback } from 'react';
import { apiGet, apiPatch } from '@/lib/api/client';
import { formatDistanceToNow } from 'date-fns';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface InAppNotification {
  id: number;           // notification_recipient id
  notification_id: number;
  title: string;
  message: string;
  notification_type: 'informational' | 'urgent' | 'reminder';
  read_at: string | null;
  created_at: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

const typeColors: Record<InAppNotification['notification_type'], string> = {
  informational: 'bg-info/10 text-info',
  urgent:        'bg-danger/10 text-danger',
  reminder:      'bg-secondary/10 text-secondary',
};

function UserAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold">
      {initials}
    </div>
  );
}

/* ─── Notification dropdown ─────────────────────────────────────────── */

function NotificationDropdown({
  notifications,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: InAppNotification[];
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
}) {
  const unread = notifications.filter((n) => !n.read_at);

  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl border border-border-gray shadow-lg z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-gray">
        <span className="font-heading text-sm font-semibold text-dark">Notifications</span>
        {unread.length > 0 && (
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      {notifications.length === 0 ? (
        <div className="py-10 text-center text-sm text-medium-gray">
          No notifications yet
        </div>
      ) : (
        <ul className="divide-y divide-border-gray">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`px-4 py-3 cursor-pointer hover:bg-surface transition-colors ${
                !n.read_at ? 'bg-primary/[0.03]' : ''
              }`}
              onClick={() => {
                if (!n.read_at) onMarkRead(n.id);
              }}
            >
              <div className="flex items-start gap-3">
                {/* Unread dot */}
                <div className="mt-1.5 shrink-0">
                  {!n.read_at ? (
                    <span className="w-2 h-2 rounded-full bg-primary block" />
                  ) : (
                    <span className="w-2 h-2 block" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-dark truncate">{n.title}</span>
                    <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${typeColors[n.notification_type]}`}>
                      {n.notification_type}
                    </span>
                  </div>
                  <p className="text-xs text-medium-gray line-clamp-2 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-light-gray mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── TopBar ─────────────────────────────────────────────────────────── */

export interface Breadcrumb {
  label: string;
  href?: string;
}

export function TopBar() {
  const { user } = useUser();
  const { title, breadcrumbs } = usePage();

  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  // Fetch on mount
  useEffect(() => {
    apiGet<InAppNotification[]>('/me/notifications')
      .then((data) => setNotifications((data ?? []).slice(0, 5)))
      .catch(() => {/* silent — non-critical */});
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const markRead = useCallback(async (recipientId: number) => {
    try {
      await apiPatch(`/me/notifications/${recipientId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === recipientId ? { ...n, read_at: new Date().toISOString() } : n)),
      );
    } catch {/* silent */}
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read_at);
    await Promise.allSettled(unread.map((n) => apiPatch(`/me/notifications/${n.id}/read`)));
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }, [notifications]);

  return (
    <header className="h-16 bg-white border-b border-border-gray flex items-center px-8 shrink-0">
      {/* Left: title + breadcrumbs */}
      <div className="flex-1 min-w-0">
        {breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-light-gray" />}
                  {isLast || !crumb.href ? (
                    <span className="font-heading text-sm font-semibold text-dark">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="text-medium-gray hover:text-dark transition-colors">
                      {crumb.label}
                    </Link>
                  )}
                </span>
              );
            })}
          </nav>
        ) : (
          <h1 className="font-heading text-xl font-semibold text-dark truncate">{title}</h1>
        )}
      </div>

      {/* Right: icons + user */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="relative p-2 rounded-lg text-medium-gray hover:bg-surface hover:text-dark transition-colors"
          title="Announcements"
        >
          <Megaphone className="w-5 h-5" />
        </button>

        {/* Notification bell with dropdown */}
        <div ref={bellRef} className="relative">
          <button
            type="button"
            className="relative p-2 rounded-lg text-medium-gray hover:bg-surface hover:text-dark transition-colors"
            title="Notifications"
            onClick={() => setDropdownOpen((o) => !o)}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-danger text-white text-[10px] font-semibold leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {dropdownOpen && (
            <NotificationDropdown
              notifications={notifications}
              onMarkRead={markRead}
              onMarkAllRead={markAllRead}
            />
          )}
        </div>

        {user && (
          <div className="flex items-center gap-2.5 ml-2 pl-3 border-l border-border-gray">
            <span className="text-sm font-medium text-dark hidden sm:block">
              {user.first_name} {user.last_name}
            </span>
            <UserAvatar firstName={user.first_name} lastName={user.last_name} />
          </div>
        )}
      </div>
    </header>
  );
}

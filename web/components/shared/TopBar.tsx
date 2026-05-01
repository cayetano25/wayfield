'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Megaphone, CheckCheck, Menu, User, LogOut, Heart, Receipt } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import type { AdminUser } from '@/lib/auth/session';
import { useEffect, useRef, useState, useCallback } from 'react';
import { apiGet, apiPatch } from '@/lib/api/client';
import { formatDistanceToNow } from 'date-fns';
import { UserAvatar } from '@/components/nav/UserAvatar';
import { NavLink } from '@/components/nav/NavLink';
import { useNavContext } from '@/lib/hooks/useNavContext';

/* --- Types ---------------------------------------------------------------- */

interface InAppNotification {
  id: number;           // notification_recipient id
  notification_id: number;
  title: string;
  message: string;
  notification_type: 'informational' | 'urgent' | 'reminder';
  workshop_id: number | null;
  read_at: string | null;
  created_at: string;
}

interface RawNotificationItem {
  recipient_id: number;
  notification_id: number;
  title: string;
  message: string;
  notification_type: 'informational' | 'urgent' | 'reminder';
  read_at: string | null;
  created_at: string;
  workshop_context: { workshop_id: number; workshop_title: string } | null;
}

/* --- Helpers -------------------------------------------------------------- */

const typeColors: Record<InAppNotification['notification_type'], string> = {
  informational: 'bg-info/10 text-info',
  urgent:        'bg-danger/10 text-danger',
  reminder:      'bg-secondary/10 text-secondary',
};


function UserMenuDropdown({
  user,
  onClose,
  onLogout,
}: {
  user: AdminUser;
  onClose: () => void;
  onLogout: () => Promise<void>;
}) {
  return (
    <div className="absolute top-full right-0 mt-2 w-[220px] bg-white rounded-lg border border-[#E5E7EB] shadow-lg z-50 overflow-hidden">
      {/* Identity header — not clickable */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-[#F3F4F6]" style={{ backgroundColor: '#FAFAFA' }}>
        <UserAvatar
          firstName={user.first_name}
          lastName={user.last_name}
          profileImageUrl={user.profile_image_url}
          size={36}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#2E2E2E] truncate">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-xs text-[#9CA3AF] truncate">{user.email}</p>
        </div>
      </div>

      {/* Menu items */}
      <div className="py-1">
        <Link
          href="/profile"
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
        >
          <User className="w-4 h-4 shrink-0 text-[#6B7280]" />
          Profile Settings
        </Link>

        <Link
          href="/notifications"
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
        >
          <Bell className="w-4 h-4 shrink-0 text-[#6B7280]" />
          Notifications
        </Link>

        <Link
          href="/account/favorites"
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
        >
          <Heart className="w-4 h-4 shrink-0 text-[#6B7280]" />
          My Favorites
        </Link>

        <Link
          href="/account/receipts"
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
        >
          <Receipt className="w-4 h-4 shrink-0 text-[#6B7280]" />
          My Receipts
        </Link>
      </div>

      <div className="border-t border-[#F3F4F6]" />

      {/* Sign out */}
      <div className="py-1">
        <button
          type="button"
          onClick={() => { onClose(); void onLogout(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#EF4444] hover:bg-[#F9FAFB] transition-colors font-medium"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

/* --- Notification dropdown ------------------------------------------------ */

function NotificationDropdown({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onNavigate,
}: {
  notifications: InAppNotification[];
  onMarkRead: (id: number) => Promise<void>;
  onMarkAllRead: () => void;
  onNavigate: (workshopId: number | null) => void;
}) {
  const unread = notifications.filter((n) => !n.read_at);

  async function handleItemClick(n: InAppNotification) {
    if (!n.read_at) await onMarkRead(n.id);
    onNavigate(n.workshop_id);
  }

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
              onClick={() => handleItemClick(n)}
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

/* --- TopBar --------------------------------------------------------------- */

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface TopBarProps {
  onMenuOpen?: () => void;
}

export function TopBar({ onMenuOpen }: TopBarProps) {
  const { user, logout } = useUser();
  const nav = useNavContext();
  const router = useRouter();

  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  // Fetch on mount
  useEffect(() => {
    apiGet<{ data?: RawNotificationItem[] } | RawNotificationItem[]>('/me/notifications')
      .then((res) => {
        const raw = Array.isArray(res) ? res : ((res as { data?: RawNotificationItem[] }).data ?? []);
        const list: InAppNotification[] = raw.map((r) => ({
          id: r.recipient_id,
          notification_id: r.notification_id,
          title: r.title,
          message: r.message,
          notification_type: r.notification_type,
          workshop_id: r.workshop_context?.workshop_id ?? null,
          read_at: r.read_at,
          created_at: r.created_at,
        }));
        setNotifications(list.slice(0, 5));
      })
      .catch(() => {/* silent — non-critical */});
  }, []);

  // Close notification dropdown on outside click
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

  // Close user menu on outside click or Escape
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setUserMenuOpen(false);
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [userMenuOpen]);

  const markRead = useCallback(async (recipientId: number): Promise<void> => {
    try {
      await apiPatch(`/me/notifications/${recipientId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === recipientId ? { ...n, read_at: new Date().toISOString() } : n)),
      );
    } catch {/* silent */}
  }, []);

  const handleNavigate = useCallback((workshopId: number | null) => {
    setDropdownOpen(false);
    if (workshopId) {
      router.push(`/dashboard/workshops/${workshopId}/notifications`);
    }
  }, [router]);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read_at);
    await Promise.allSettled(unread.map((n) => apiPatch(`/me/notifications/${n.id}/read`)));
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }, [notifications]);

  return (
    <header className="h-16 bg-white border-b border-border-gray flex items-center px-4 lg:px-8 shrink-0">
      {/* Hamburger — below lg */}
      <button
        type="button"
        onClick={onMenuOpen}
        className="p-2 rounded-lg text-medium-gray hover:bg-surface hover:text-dark transition-colors lg:hidden shrink-0"
        aria-label="Open navigation"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Center: nav links (sm+) */}
      <nav className="hidden sm:flex items-center gap-6 h-full flex-1 justify-center" aria-label="Main navigation">
        <NavLink href="/discover" label="Explore Workshops" />
        {nav.isAuthenticated && <NavLink href="/my-workshops" label="My Workshops" />}
        {nav.showMySessions && <NavLink href="/leader/dashboard" label="My Sessions" />}
        {nav.showMyOrganization && <NavLink href="/my-organizations" label="My Organizations" />}
      </nav>

      {/* Spacer on mobile keeps right section right-aligned when nav is hidden */}
      <div className="flex-1 sm:hidden" />

      {/* Right: icons + user */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-medium-gray hover:bg-surface hover:text-dark transition-colors"
          title="Announcements"
        >
          <Megaphone className="w-5 h-5" />
        </button>

        {/* Notification bell with dropdown */}
        <div ref={bellRef} className="relative">
          <button
            type="button"
            className="relative w-9 h-9 flex items-center justify-center rounded-lg text-medium-gray hover:bg-surface hover:text-dark transition-colors"
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
              onNavigate={handleNavigate}
            />
          )}
        </div>

        {user && (
          <div ref={userMenuRef} className="relative ml-1 pl-3 border-l border-border-gray">
            <button
              type="button"
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2 px-1 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors hover:bg-surface"
              aria-label="Open user menu"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <UserAvatar
                firstName={user.first_name}
                lastName={user.last_name}
                profileImageUrl={user.profile_image_url}
                size={32}
              />
              <span
                className="hidden sm:block max-w-[140px] truncate"
                style={{
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize:   13,
                  fontWeight: 500,
                  color:      '#374151',
                }}
              >
                {user.first_name} {user.last_name}
              </span>
            </button>

            {userMenuOpen && (
              <UserMenuDropdown
                user={user}
                onClose={() => setUserMenuOpen(false)}
                onLogout={logout}
              />
            )}
          </div>
        )}
      </div>
    </header>
  );
}

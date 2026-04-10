'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, User, Backpack, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { apiGet } from '@/lib/api/client';
import type { AdminUser } from '@/lib/auth/session';

/* ─── User avatar ─────────────────────────────────────────────────────── */

function UserAvatar({
  firstName,
  lastName,
  imageUrl,
  size = 'sm',
}: {
  firstName: string;
  lastName: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'md' ? 'w-9 h-9 text-sm' : 'w-8 h-8 text-xs';
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`${firstName} ${lastName}`}
        className={`${dim} rounded-full object-cover shrink-0`}
      />
    );
  }
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  return (
    <div
      className={`${dim} rounded-full bg-primary flex items-center justify-center text-white font-semibold shrink-0`}
    >
      {initials}
    </div>
  );
}

/* ─── User menu dropdown ──────────────────────────────────────────────── */

function UserMenuDropdown({
  user,
  onClose,
  onLogout,
}: {
  user: AdminUser;
  onClose: () => void;
  onLogout: () => Promise<void>;
}) {
  const initials = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase();
  return (
    <div
      className="absolute top-full right-0 mt-2 bg-white rounded-lg z-50 overflow-hidden"
      style={{
        width: 220,
        border: '1px solid #E5E7EB',
        boxShadow: '0 10px 40px rgba(0,0,0,0.10)',
      }}
    >
      {/* Identity header */}
      <div
        className="px-4 py-3 flex items-center gap-3"
        style={{ borderBottom: '1px solid #F3F4F6' }}
      >
        {user.profile_image_url ? (
          <img
            src={user.profile_image_url}
            alt=""
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#374151' }}>
            {user.first_name} {user.last_name}
          </p>
          <p className="text-xs truncate" style={{ color: '#6B7280' }}>
            {user.email}
          </p>
        </div>
      </div>

      {/* Links */}
      <div className="py-1">
        <Link
          href="/admin/profile"
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#F9FAFB] transition-colors"
          style={{ color: '#374151' }}
        >
          <User className="w-4 h-4 shrink-0" style={{ color: '#6B7280' }} />
          Profile Settings
        </Link>
        <Link
          href="/my-workshops"
          onClick={onClose}
          className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F9FAFB] transition-colors"
        >
          <Backpack className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#6B7280' }} />
          <div>
            <p className="text-sm" style={{ color: '#374151' }}>My Workshops</p>
            <p className="text-[11px]" style={{ color: '#9CA3AF' }}>
              Workshops I&apos;m attending
            </p>
          </div>
        </Link>
      </div>

      <div style={{ borderTop: '1px solid #F3F4F6' }} />

      <div className="py-1">
        <button
          type="button"
          onClick={() => { onClose(); void onLogout(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#F9FAFB] transition-colors"
          style={{ color: '#EF4444' }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

/* ─── Nav link ────────────────────────────────────────────────────────── */

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className="relative flex items-center h-full font-sans text-sm transition-colors"
      style={{ color: isActive ? '#0FA3B1' : '#374151', padding: '0 4px' }}
    >
      {label}
      {isActive && (
        <span
          className="absolute bottom-0 left-0 right-0"
          style={{ height: 2, backgroundColor: '#0FA3B1', borderRadius: 9999 }}
        />
      )}
    </Link>
  );
}

/* ─── Participant shell ────────────────────────────────────────────────── */

export function ParticipantShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useUser();
  const router = useRouter();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
  useEffect(() => {
    apiGet<{ data?: { read_at: string | null }[] } | { read_at: string | null }[]>(
      '/me/notifications',
    )
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : ((res as { data?: { read_at: string | null }[] }).data ?? []);
        setUnreadCount(list.filter((n) => !n.read_at).length);
      })
      .catch(() => {});
  }, []);

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

  // Redirect if unauthenticated
  useEffect(() => {
    if (!user) return;
  }, [user, router]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F5F5' }}>
      {/* Top navigation */}
      <header
        className="bg-white shrink-0 flex items-center"
        style={{
          height: 56,
          borderBottom: '1px solid #E5E7EB',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        <div className="w-full max-w-5xl mx-auto px-4 flex items-center justify-between h-full">
          {/* Logo */}
          <Link href="/my-workshops" className="font-heading font-extrabold text-xl shrink-0">
            <span style={{ color: '#2E2E2E' }}>Way</span>
            <span style={{ color: '#0FA3B1' }}>field</span>
          </Link>

          {/* Center nav */}
          <nav className="flex items-center gap-6 h-full">
            <NavLink href="/my-workshops" label="My Workshops" />
            <NavLink href="/schedule" label="Schedule" />
            <NavLink href="/notifications" label="Notifications" />
          </nav>

          {/* Right: bell + avatar */}
          <div className="flex items-center gap-3">
            {/* Bell */}
            <button
              type="button"
              className="relative p-2 rounded-lg text-medium-gray hover:bg-surface hover:text-dark transition-colors"
              title="Notifications"
              onClick={() => router.push('/notifications')}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span
                  className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-white font-semibold leading-none"
                  style={{ fontSize: 10, backgroundColor: '#E94F37' }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* User avatar + dropdown */}
            {user && (
              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  <UserAvatar
                    firstName={user.first_name}
                    lastName={user.last_name}
                    imageUrl={user.profile_image_url}
                  />
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
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}

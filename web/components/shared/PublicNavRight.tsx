'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Backpack, LogOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { clearToken, clearStoredUser } from '@/lib/auth/session';
import type { AdminUser } from '@/lib/auth/session';

/* ─── User avatar ─────────────────────────────────────────────────────── */

function UserAvatar({ user }: { user: AdminUser }) {
  const initials = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase();
  if (user.profile_image_url) {
    return (
      <img
        src={user.profile_image_url}
        alt={`${user.first_name} ${user.last_name}`}
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
      style={{ background: 'linear-gradient(135deg, #0FA3B1 0%, #0074A6 100%)' }}>
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
  onLogout: () => void;
}) {
  const initials = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase();
  return (
    <div
      className="absolute top-full right-0 mt-2 bg-white rounded-lg z-50 overflow-hidden"
      style={{ width: 220, border: '1px solid #E5E7EB', boxShadow: '0 10px 40px rgba(0,0,0,0.10)' }}
    >
      <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #F3F4F6' }}>
        {user.profile_image_url ? (
          <img src={user.profile_image_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
            style={{ background: 'linear-gradient(135deg, #0FA3B1 0%, #0074A6 100%)' }}>
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#374151' }}>
            {user.first_name} {user.last_name}
          </p>
          <p className="text-xs truncate" style={{ color: '#6B7280' }}>{user.email}</p>
        </div>
      </div>

      <div className="py-1">
        <Link href="/admin/profile" onClick={onClose}
          className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#F9FAFB] transition-colors"
          style={{ color: '#374151' }}>
          <User className="w-4 h-4 shrink-0" style={{ color: '#6B7280' }} />
          Profile Settings
        </Link>
        <Link href="/my-workshops" onClick={onClose}
          className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F9FAFB] transition-colors">
          <Backpack className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#6B7280' }} />
          <div>
            <p className="text-sm" style={{ color: '#374151' }}>My Workshops</p>
            <p className="text-[11px]" style={{ color: '#9CA3AF' }}>Workshops I&apos;m attending</p>
          </div>
        </Link>
      </div>

      <div style={{ borderTop: '1px solid #F3F4F6' }} />
      <div className="py-1">
        <button type="button" onClick={() => { onClose(); onLogout(); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#F9FAFB] transition-colors"
          style={{ color: '#EF4444' }}>
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

/* ─── PublicNavRight ──────────────────────────────────────────────────── */

interface PublicNavRightProps {
  user: AdminUser | null;
}

export function PublicNavRight({ user }: PublicNavRightProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const onboardingComplete = !!user?.onboarding_completed_at;

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  function handleLogout() {
    clearToken();
    clearStoredUser();
    router.push('/login');
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="font-sans text-sm font-semibold transition-colors hover:opacity-80"
          style={{ color: '#374151' }}
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="font-sans text-sm font-semibold rounded-lg transition-colors hover:opacity-90"
          style={{ padding: '8px 18px', backgroundColor: '#0FA3B1', color: 'white' }}
        >
          Create Account
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {!onboardingComplete && (
        <Link
          href="/onboarding"
          className="font-sans text-sm font-semibold rounded-lg transition-colors hover:opacity-90"
          style={{ padding: '8px 18px', backgroundColor: '#0FA3B1', color: 'white' }}
        >
          Complete Setup
        </Link>
      )}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="rounded-full focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:ring-offset-2"
        >
          <UserAvatar user={user} />
        </button>
        {menuOpen && (
          <UserMenuDropdown
            user={user}
            onClose={() => setMenuOpen(false)}
            onLogout={handleLogout}
          />
        )}
      </div>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useAdminUser } from '@/contexts/AdminUserContext';
import { clearToken, platformAuth } from '@/lib/platform-api';
import RoleBadge from './RoleBadge';

export default function TopBar() {
  const router = useRouter();
  const { adminUser, setAdminUser } = useAdminUser();

  async function handleSignOut() {
    platformAuth.logout().catch(() => {});
    clearToken();
    setAdminUser(null);
    router.replace('/login');
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-14 z-30 flex items-center justify-between bg-[#111827]">
      {/* Left: logo mark + wordmark + separator + app name */}
      <div className="flex items-center pl-4">
        <div className="w-2.5 h-2.5 rounded-sm bg-[#0FA3B1] shrink-0" />
        <span className="ml-2 font-heading text-sm font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-sora, sans-serif)' }}>
          WAYFIELD
        </span>
        <span className="mx-3 text-gray-600">·</span>
        <span
          className="text-[11px] text-gray-400 uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
        >
          Command Center
        </span>
      </div>

      {/* Right: admin name, role badge, sign out */}
      {adminUser && (
        <div className="flex items-center gap-3 pr-4">
          <span className="text-sm text-white font-medium">
            {adminUser.first_name} {adminUser.last_name}
          </span>
          <RoleBadge role={adminUser.role} />
          <button
            onClick={handleSignOut}
            className="min-h-[44px] px-3 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}

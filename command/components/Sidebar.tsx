'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  FileText,
  Activity,
  LifeBuoy,
  Megaphone,
  LogOut,
} from 'lucide-react';
import { useAdminUser } from '@/contexts/AdminUserContext';
import RoleBadge from './RoleBadge';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/overview',      label: 'Overview',       icon: LayoutDashboard },
  { href: '/organizations', label: 'Organizations',  icon: Building2 },
  { href: '/users',         label: 'Users',          icon: Users },
  { href: '/financials',    label: 'Financials',     icon: CreditCard },
  { href: '/audit-logs',    label: 'Audit Logs',     icon: FileText },
  { href: '/health',        label: 'System Health',  icon: Activity },
  { href: '/support',       label: 'Support',        icon: LifeBuoy },
  { href: '/announcements', label: 'Announcements',  icon: Megaphone },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { adminUser, logout } = useAdminUser();

  return (
    <aside className="flex flex-col w-64 shrink-0 bg-gray-900 border-r border-gray-800 h-full">
      {/* Wordmark */}
      <div className="flex items-center h-16 px-5 border-b border-gray-800 shrink-0">
        <span className="font-heading text-lg font-semibold text-white tracking-tight">
          Wayfield
        </span>
        <span className="ml-2 text-xs text-gray-500 font-medium">CC</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 h-11 px-3 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand/15 text-brand'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
              }`}
            >
              <Icon size={18} className={active ? 'text-brand' : 'text-gray-500'} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Admin user footer */}
      {adminUser && (
        <div className="shrink-0 border-t border-gray-800 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-100 truncate">
                {adminUser.first_name} {adminUser.last_name}
              </p>
              <div className="mt-1">
                <RoleBadge role={adminUser.role} size="xs" />
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Sign out"
              className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

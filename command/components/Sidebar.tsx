'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  CreditCard,
  MessageCircle,
  Zap,
  Shield,
  ClipboardList,
  Settings,
} from 'lucide-react';
import { useAdminUser, can } from '@/contexts/AdminUserContext';
import { AdminRole } from '@/lib/platform-api';
import RoleBadge from './RoleBadge';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { adminUser } = useAdminUser();

  if (!adminUser) return null;

  const role = adminUser.role as AdminRole;

  // Build nav items dynamically based on role
  const group1: NavItem[] = [
    { href: '/overview',      label: 'Overview',       icon: LayoutDashboard },
    { href: '/organizations', label: 'Organisations',  icon: Building2 },
    ...(can.viewUsers(role)      ? [{ href: '/users',      label: 'Users',      icon: Users }]         : []),
    ...(can.viewFinancials(role) ? [{ href: '/financials', label: 'Financials', icon: CreditCard }]    : []),
    ...(can.viewSupport(role)    ? [{ href: '/support',    label: 'Support',    icon: MessageCircle }] : []),
  ];

  const group2: NavItem[] = [
    ...(can.manageAutomations(role) ? [{ href: '/automations', label: 'Automations', icon: Zap }]             : []),
    ...(can.viewSecurity(role)      ? [{ href: '/security',    label: 'Security',    icon: Shield }]           : []),
    ...(can.viewAuditLog(role)      ? [{ href: '/audit',       label: 'Audit Log',   icon: ClipboardList }]    : []),
    ...(can.manageSettings(role)    ? [{ href: '/settings',    label: 'Settings',    icon: Settings }]         : []),
  ];

  function NavLink({ href, label, icon: Icon }: NavItem) {
    const active = pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        href={href}
        className={`h-10 flex items-center gap-3 rounded-lg text-sm px-3 transition-colors duration-150 ${
          active
            ? 'border-l-2 border-[#0FA3B1] bg-[#0FA3B1]/10 text-white pl-[10px]'
            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }`}
      >
        <Icon size={16} />
        {label}
      </Link>
    );
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-56 z-20 bg-gray-900 overflow-hidden flex flex-col px-3 pt-16 pb-6">
      <nav className="flex flex-col gap-0.5">
        {group1.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}

        {group2.length > 0 && (
          <>
            <div className="my-3 border-t border-gray-800" />
            {group2.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom: role badge + name */}
      <div className="mt-auto">
        <RoleBadge role={adminUser.role} size="xs" />
        <p
          className="mt-1 text-[11px] text-gray-500"
          style={{ fontFamily: 'var(--font-plus-jakarta, sans-serif)' }}
        >
          {adminUser.first_name} {adminUser.last_name}
        </p>
      </div>
    </aside>
  );
}

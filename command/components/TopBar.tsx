'use client';

import { usePathname } from 'next/navigation';
import { useAdminUser } from '@/contexts/AdminUserContext';

const PAGE_TITLES: Record<string, string> = {
  '/overview':      'Overview',
  '/organizations': 'Organizations',
  '/users':         'Users',
  '/financials':    'Financials',
  '/audit-logs':    'Audit Logs',
  '/health':        'System Health',
  '/support':       'Support',
  '/announcements': 'Announcements',
};

function resolveTitle(pathname: string): string {
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return title;
  }
  return 'Command Center';
}

export default function TopBar() {
  const pathname = usePathname();
  const { adminUser } = useAdminUser();

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-6 bg-white border-b border-gray-200">
      <h1 className="font-heading text-base font-semibold text-gray-900">
        {resolveTitle(pathname)}
      </h1>
      {adminUser && (
        <span className="text-sm text-gray-500">
          {adminUser.email}
        </span>
      )}
    </header>
  );
}

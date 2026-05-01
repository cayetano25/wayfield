'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';

const TABS = [
  { label: 'Overview',      slug: '' },
  { label: 'Sessions',      slug: 'sessions' },
  { label: 'Leaders',       slug: 'leaders' },
  { label: 'Participants',  slug: 'participants' },
  { label: 'Attendance',    slug: 'attendance' },
  { label: 'Notifications', slug: 'notifications' },
  { label: 'Pricing',       slug: 'pricing' },
  { label: 'Orders',        slug: 'orders' },
];

export function WorkshopTabs() {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  const base = `/dashboard/workshops/${id}`;

  return (
    <div style={{ backgroundColor: '#F0F9FA', borderBottom: '1px solid #C8E8EC' }}>
      <nav className="flex overflow-x-auto scrollbar-none px-4 lg:px-6">
        {TABS.map(({ label, slug }) => {
          const href = slug ? `${base}/${slug}` : base;
          const isActive = slug === ''
            ? pathname === base || pathname === `${base}/edit`
            : pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              className={`
                flex-shrink-0 h-10 px-4 flex items-center text-sm font-medium
                border-b-2 transition-colors whitespace-nowrap
                ${isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent hover:text-dark'
                }
              `}
              style={{ color: isActive ? '#0FA3B1' : '#4B6A6E' }}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

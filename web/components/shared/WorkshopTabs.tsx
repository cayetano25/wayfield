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
];

export function WorkshopTabs() {
  const pathname = usePathname();
  const { id } = useParams<{ id: string }>();
  const base = `/workshops/${id}`;

  return (
    <div className="bg-white border-b border-border-gray">
      <nav className="flex overflow-x-auto scrollbar-none">
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
                flex-shrink-0 h-12 px-5 flex items-center text-sm font-medium
                border-b-2 transition-colors whitespace-nowrap
                ${isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-medium-gray hover:text-dark'
                }
              `}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

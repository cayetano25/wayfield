'use client';

import Link from 'next/link';
import { Bell, Megaphone, ChevronRight } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { usePage } from '@/contexts/PageContext';

export interface Breadcrumb {
  label: string;
  href?: string;
}

function UserAvatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold">
      {initials}
    </div>
  );
}

export function TopBar() {
  const { user } = useUser();
  const { title, breadcrumbs } = usePage();

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

        <button
          type="button"
          className="relative p-2 rounded-lg text-medium-gray hover:bg-surface hover:text-dark transition-colors"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
        </button>

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

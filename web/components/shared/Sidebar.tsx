'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Users,
  CreditCard,
  BarChart3,
  HelpCircle,
  LogOut,
  X,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const mainItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/workshops', label: 'Workshops', icon: CalendarDays },
];

const orgItems: NavItem[] = [
  { href: '/organization/settings', label: 'Settings', icon: Building2 },
  { href: '/organization/members', label: 'Members', icon: Users },
  { href: '/organization/billing', label: 'Billing', icon: CreditCard },
];

const bottomItems: NavItem[] = [
  { href: '/reports', label: 'Reports', icon: BarChart3 },
];

const BILLING_ROLES = ['owner', 'billing_admin'];

function NavLink({ href, label, icon: Icon, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={`
        flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium
        transition-colors relative
        ${active
          ? 'text-primary bg-primary/8 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:bg-primary before:rounded-r'
          : 'text-dark hover:bg-surface'
        }
      `}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </Link>
  );
}

function UserAvatar({
  firstName,
  lastName,
  imageUrl,
}: {
  firstName: string;
  lastName: string;
  imageUrl?: string | null;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`${firstName} ${lastName}`}
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />
    );
  }
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold shrink-0">
      {initials}
    </div>
  );
}

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, currentOrg, logout } = useUser();

  const role = currentOrg?.role ?? '';
  const canSeeBilling = BILLING_ROLES.includes(role);

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-[240px] h-full bg-white border-r border-border-gray flex flex-col shrink-0">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border-gray flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-heading text-2xl font-extrabold text-primary">Wayfield</span>
          {currentOrg && (
            <p className="text-xs text-light-gray mt-1 truncate">{currentOrg.name}</p>
          )}
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-1 p-1 rounded-md text-light-gray hover:text-dark hover:bg-surface transition-colors shrink-0 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
        {mainItems.map((item) => (
          <NavLink key={item.href} {...item} active={isActive(item.href)} />
        ))}

        {/* ORGANIZATION section */}
        <div className="mt-4 mb-1 px-4">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-light-gray">
            Organization
          </span>
        </div>

        {orgItems
          .filter((item) => item.href !== '/organization/billing' || canSeeBilling)
          .map((item) => (
            <NavLink key={item.href} {...item} active={isActive(item.href)} />
          ))}

        <div className="mt-4 flex flex-col gap-1">
          {bottomItems.map((item) => (
            <NavLink key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </div>
      </nav>

      {/* Help */}
      <div className="px-3 pb-2">
        <NavLink href="/help" label="Help" icon={HelpCircle} active={isActive('/help')} />
      </div>

      {/* Footer */}
      <div className="border-t border-border-gray px-4 py-4">
        {user && (
          <div className="flex items-center gap-3">
            <UserAvatar
              firstName={user.first_name}
              lastName={user.last_name}
              imageUrl={user.profile_image_url}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark truncate">
                {user.first_name} {user.last_name}
              </p>
              <Link
                href="/profile"
                className="text-xs text-light-gray hover:text-primary transition-colors"
              >
                Profile
              </Link>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="text-light-gray hover:text-dark transition-colors p-1"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

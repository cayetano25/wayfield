import Link from 'next/link';
import { cookies } from 'next/headers';
import { Globe, Share2 } from 'lucide-react';
import { PublicNavRight } from '@/components/shared/PublicNavRight';
import type { AdminUser } from '@/lib/auth/session';

const NAV_LINKS = [
  { label: 'Discover', href: '/discover' },
  { label: 'Ateliers', href: '#' },
  { label: 'Community', href: '#' },
];

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Read user from cookie server-side for auth-aware nav
  const cookieStore = await cookies();
  const userCookie = cookieStore.get('wayfield_user');
  let user: AdminUser | null = null;
  if (userCookie?.value) {
    try {
      user = JSON.parse(decodeURIComponent(userCookie.value)) as AdminUser;
    } catch {
      // ignore malformed cookie
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F5F5F5' }}>
      {/* Top nav */}
      <header
        className="sticky top-0 z-50 flex items-center"
        style={{
          height: 64,
          backgroundColor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <div
          className="w-full mx-auto px-6 flex items-center justify-between"
          style={{ maxWidth: 1200 }}
        >
          {/* Logo */}
          <Link href="/discover" className="font-heading font-extrabold text-xl shrink-0">
            <span style={{ color: '#2E2E2E' }}>Way</span>
            <span style={{ color: '#0FA3B1' }}>field</span>
          </Link>

          {/* Center nav links */}
          <nav className="flex items-center gap-6">
            {NAV_LINKS.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="font-sans text-sm transition-colors hover:text-[#0FA3B1]"
                style={{ color: '#374151' }}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Right: auth-aware */}
          <PublicNavRight user={user} />
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer
        className="bg-white"
        style={{ borderTop: '1px solid #E5E7EB', padding: '32px 64px' }}
      >
        <div
          className="mx-auto flex items-center justify-between"
          style={{ maxWidth: 1200 }}
        >
          {/* Left: brand */}
          <span className="font-heading font-bold" style={{ fontSize: 14, color: '#2E2E2E' }}>
            Wayfield
          </span>

          {/* Center: links */}
          <div className="flex items-center gap-6">
            {['Terms', 'Privacy', 'Support'].map((label) => (
              <a
                key={label}
                href="#"
                className="font-sans transition-colors hover:text-[#0FA3B1]"
                style={{ fontSize: 13, color: '#6B7280' }}
              >
                {label}
              </a>
            ))}
          </div>

          {/* Right: icons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="p-2 rounded-lg transition-colors hover:bg-[#F3F4F6]"
              title="Share"
            >
              <Share2 className="w-4 h-4" style={{ color: '#9CA3AF' }} />
            </button>
            <button
              type="button"
              className="p-2 rounded-lg transition-colors hover:bg-[#F3F4F6]"
              title="Language"
            >
              <Globe className="w-4 h-4" style={{ color: '#9CA3AF' }} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

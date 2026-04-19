import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { discoverWorkshops } from '@/lib/api/public';
import type { AdminUser } from '@/lib/auth/session';
import { WelcomeHero } from './components/WelcomeHero';
import { WorkshopCard } from './components/WorkshopCard';
import { CategoryFilter } from './components/CategoryFilter';

export const metadata: Metadata = {
  title: 'Discover Workshops | Wayfield',
  description: 'Discover and join photography workshops and creative events curated on Wayfield.',
};

/* ─── Feature pill row ────────────────────────────────────────────────── */

const PILLS = [
  { icon: '📅', label: 'WORKSHOP SCHEDULING' },
  { icon: '✓', label: 'DIGITAL CHECK-INS' },
  { icon: '🎓', label: 'LEADER TOOLS' },
];

function FeaturePills() {
  return (
    <div className="flex items-center justify-center gap-4 flex-wrap" style={{ padding: '28px 24px' }}>
      {PILLS.map(({ icon, label }) => (
        <span
          key={label}
          className="font-sans font-semibold"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            borderRadius: 9999,
            fontSize: 11,
            letterSpacing: '0.08em',
            color: '#6B7280',
            backgroundColor: 'white',
            border: '1px solid #E5E7EB',
          }}
        >
          <span>{icon}</span>
          {label}
        </span>
      ))}
    </div>
  );
}

/* ─── Pagination ──────────────────────────────────────────────────────── */

function PaginationLink({
  page,
  currentPage,
  searchParams,
}: {
  page: number;
  currentPage: number;
  searchParams: Record<string, string>;
}) {
  const qs = new URLSearchParams({ ...searchParams, page: String(page) });
  const isActive = page === currentPage;
  return (
    <Link
      href={`/discover?${qs.toString()}`}
      className="font-sans font-medium transition-colors"
      style={{
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        fontSize: 14,
        backgroundColor: isActive ? '#0FA3B1' : 'white',
        color: isActive ? 'white' : '#6B7280',
        border: isActive ? '1px solid #0FA3B1' : '1px solid #E5E7EB',
      }}
    >
      {page}
    </Link>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

export default async function DiscoverPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const category = params.category ?? 'All';
  const page = Math.max(1, parseInt(params.page ?? '1', 10));

  // Read user from cookies server-side
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
  const onboardingComplete = !!user?.onboarding_completed_at;

  const result = await discoverWorkshops({ category, page });
  const workshops = result?.data ?? [];
  const meta = result?.meta;
  const totalPages = meta?.last_page ?? 1;

  // Build page numbers
  const pageNumbers: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    const near = new Set(
      [1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages),
    );
    const sorted = [...near].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) pageNumbers.push('ellipsis');
      pageNumbers.push(sorted[i]);
    }
  }

  const currentSearchParams: Record<string, string> = { category };

  return (
    <>
      {/* Section 1: Welcome hero (logged-in only) */}
      {user && (
        <WelcomeHero user={user} onboardingComplete={onboardingComplete} />
      )}

      {/* Section 2: Feature pills */}
      <FeaturePills />

      {/* Section 3: Workshop discovery grid */}
      <div className="mx-auto" style={{ maxWidth: 1200, padding: '0 24px 64px' }}>
        {/* Section header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p
              className="font-sans font-semibold uppercase"
              style={{ fontSize: 10, letterSpacing: '0.1em', color: '#9CA3AF', marginBottom: 4 }}
            >
              AVAILABLE WORKSHOPS
            </p>
            <h2 className="font-heading font-bold" style={{ fontSize: 28, color: '#2E2E2E' }}>
              Discover Workshops
            </h2>
          </div>
          <Suspense>
            <CategoryFilter
              activeCategory={category}
              currentParams={currentSearchParams}
            />
          </Suspense>
        </div>

        {/* Workshop grid */}
        {workshops.length === 0 ? (
          <div
            className="flex flex-col items-center text-center"
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: '64px 32px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <p
              className="font-heading font-semibold mb-2"
              style={{ fontSize: 18, color: '#2E2E2E' }}
            >
              No workshops available in this category right now.
            </p>
            <Link
              href="/onboarding"
              className="font-sans font-semibold hover:underline mt-1"
              style={{ fontSize: 14, color: '#0FA3B1' }}
            >
              Check back soon or create your own →
            </Link>
          </div>
        ) : (
          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}
          >
            {workshops.map((workshop) => (
              <WorkshopCard key={workshop.public_slug} workshop={workshop} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            {page > 1 && (
              <Link
                href={`/discover?${new URLSearchParams({ ...currentSearchParams, page: String(page - 1) })}`}
                className="font-sans text-sm font-medium transition-colors hover:text-[#0FA3B1]"
                style={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  color: '#6B7280',
                  backgroundColor: 'white',
                }}
                aria-label="Previous page"
              >
                ‹
              </Link>
            )}
            {pageNumbers.map((p, i) =>
              p === 'ellipsis' ? (
                <span key={`ellipsis-${i}`} className="px-1" style={{ color: '#9CA3AF', fontSize: 14 }}>
                  …
                </span>
              ) : (
                <PaginationLink
                  key={p}
                  page={p}
                  currentPage={page}
                  searchParams={currentSearchParams}
                />
              ),
            )}
            {page < totalPages && (
              <Link
                href={`/discover?${new URLSearchParams({ ...currentSearchParams, page: String(page + 1) })}`}
                className="font-sans text-sm font-medium transition-colors hover:text-[#0FA3B1]"
                style={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  border: '1px solid #E5E7EB',
                  color: '#6B7280',
                  backgroundColor: 'white',
                }}
                aria-label="Next page"
              >
                ›
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}

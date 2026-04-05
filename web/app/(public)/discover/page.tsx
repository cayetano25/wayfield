import type { Metadata } from 'next';
import Link from 'next/link';
import { discoverWorkshops, type DiscoverWorkshop } from '@/lib/api/public';

export const metadata: Metadata = {
  title: 'Photography Workshops | Wayfield',
  description: 'Discover and join photography workshops and creative events curated on Wayfield.',
};

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  const s = fmt(start);
  const e = fmt(end);
  return s === e ? s : `${s} – ${e}`;
}

// Gradient placeholders keyed by index so cards look distinct
const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(135deg, #006972 0%, #0FA3B1 100%)',
  'linear-gradient(135deg, #944a00 0%, #fc8f34 100%)',
  'linear-gradient(135deg, #7EA8BE 0%, #2E2E2E 100%)',
  'linear-gradient(135deg, #b32915 0%, #fe5e44 100%)',
  'linear-gradient(135deg, #0fa3b1 0%, #7EA8BE 100%)',
  'linear-gradient(135deg, #2E2E2E 0%, #6B7280 100%)',
];

function WorkshopCard({ workshop, index }: { workshop: DiscoverWorkshop; index: number }) {
  // Never expose join_code or meeting_url — only use public fields
  const location = [
    workshop.default_location?.city,
    workshop.default_location?.state_or_region,
  ].filter(Boolean).join(', ');

  const gradient = PLACEHOLDER_GRADIENTS[index % PLACEHOLDER_GRADIENTS.length];

  return (
    <Link
      href={`/workshops/${workshop.public_slug}`}
      className="group bg-white rounded-xl border border-border-gray shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
    >
      {/* Card image / placeholder */}
      <div className="h-40 relative overflow-hidden">
        {workshop.hero_image_url ? (
          <img
            src={workshop.hero_image_url}
            alt={workshop.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full" style={{ background: gradient }} />
        )}
        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold backdrop-blur-sm ${
              workshop.workshop_type === 'session_based'
                ? 'bg-primary/90 text-white'
                : 'bg-secondary/90 text-white'
            }`}
          >
            {workshop.workshop_type === 'session_based' ? 'Session-Based' : 'Event-Based'}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="font-heading font-bold text-dark leading-snug group-hover:text-primary transition-colors line-clamp-2">
            {workshop.title}
          </h3>
          <p className="text-sm text-medium-gray mt-1.5 line-clamp-2 leading-relaxed">
            {workshop.description}
          </p>
        </div>

        <div className="mt-auto space-y-1.5 text-xs text-medium-gray">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-light-gray">calendar_today</span>
            {formatDateRange(workshop.start_date, workshop.end_date)}
          </div>
          {location && (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-light-gray">location_on</span>
              {location}
            </div>
          )}
          <div className="flex items-center gap-3 pt-1 border-t border-border-gray mt-2">
            {workshop.leaders_count > 0 && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-light-gray">person_celebrate</span>
                {workshop.leaders_count} {workshop.leaders_count === 1 ? 'leader' : 'leaders'}
              </span>
            )}
            {workshop.sessions_count > 0 && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-light-gray">schedule</span>
                {workshop.sessions_count} {workshop.sessions_count === 1 ? 'session' : 'sessions'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 pb-4">
        <span className="text-xs font-semibold text-primary group-hover:underline">
          View Workshop →
        </span>
      </div>
    </Link>
  );
}

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
      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-primary text-white'
          : 'border border-border-gray text-medium-gray hover:border-primary hover:text-primary'
      }`}
    >
      {page}
    </Link>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<Record<string, string>>;
}

export default async function DiscoverPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search ?? '';
  const type = params.type ?? 'all';
  const dateFrom = params.date_from ?? '';
  const dateTo = params.date_to ?? '';
  const page = Math.max(1, parseInt(params.page ?? '1', 10));

  const result = await discoverWorkshops({ search, type, date_from: dateFrom, date_to: dateTo, page });

  const workshops = result?.data ?? [];
  const meta = result?.meta;
  const totalPages = meta?.last_page ?? 1;

  // Build page numbers to show (±2 around current, always first/last)
  const pageNumbers: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    const near = new Set([1, totalPages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= totalPages));
    const sorted = [...near].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) pageNumbers.push('ellipsis');
      pageNumbers.push(sorted[i]);
    }
  }

  const currentSearchParams = { search, type, date_from: dateFrom, date_to: dateTo };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Page heading */}
      <div className="mb-10">
        <h1 className="font-heading text-3xl font-bold text-dark mb-2">Discover Workshops</h1>
        <p className="text-medium-gray">Browse photography workshops and creative events.</p>
      </div>

      {/* Search + Filters form */}
      <form method="GET" action="/discover" className="mb-8 space-y-4">
        {/* Search bar */}
        <div className="relative max-w-xl">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-light-gray text-xl pointer-events-none">
            search
          </span>
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search workshops..."
            className="w-full pl-10 pr-4 py-2.5 border border-border-gray rounded-lg text-sm text-dark placeholder:text-light-gray focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Workshop type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-medium-gray">Type</label>
            <select
              name="type"
              defaultValue={type}
              className="border border-border-gray rounded-lg px-3 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
            >
              <option value="all">All Types</option>
              <option value="session_based">Session-Based</option>
              <option value="event_based">Event-Based</option>
            </select>
          </div>

          {/* Date from */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-medium-gray">From</label>
            <input
              type="date"
              name="date_from"
              defaultValue={dateFrom}
              className="border border-border-gray rounded-lg px-3 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-medium-gray">To</label>
            <input
              type="date"
              name="date_to"
              defaultValue={dateTo}
              className="border border-border-gray rounded-lg px-3 py-2 text-sm text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            Search
          </button>

          {(search || type !== 'all' || dateFrom || dateTo) && (
            <Link
              href="/discover"
              className="px-5 py-2 border border-border-gray text-medium-gray text-sm font-medium rounded-lg hover:border-primary hover:text-primary transition-colors"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* Results count */}
      {meta && (
        <p className="text-sm text-medium-gray mb-6">
          {meta.total === 0
            ? 'No workshops found'
            : `${meta.total} workshop${meta.total === 1 ? '' : 's'} found`}
        </p>
      )}

      {/* Workshop grid */}
      {workshops.length === 0 ? (
        <div className="text-center py-24 bg-surface rounded-xl border border-border-gray">
          <span className="material-symbols-outlined text-5xl text-light-gray mb-4 block"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}>
            event_upcoming
          </span>
          <h3 className="font-heading text-lg font-semibold text-dark mb-2">No workshops found</h3>
          <p className="text-sm text-medium-gray max-w-xs mx-auto">
            Try adjusting your search or filters, or check back soon for new workshops.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {workshops.map((workshop, i) => (
            <WorkshopCard key={workshop.public_slug} workshop={workshop} index={i} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/discover?${new URLSearchParams({ ...currentSearchParams, page: String(page - 1) })}`}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border-gray text-medium-gray hover:border-primary hover:text-primary transition-colors"
              aria-label="Previous page"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </Link>
          )}

          {pageNumbers.map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`ellipsis-${i}`} className="px-1 text-light-gray text-sm">…</span>
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
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-border-gray text-medium-gray hover:border-primary hover:text-primary transition-colors"
              aria-label="Next page"
            >
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

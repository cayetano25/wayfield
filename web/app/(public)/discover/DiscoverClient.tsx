'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { X, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { discoverWorkshopsV2 } from '@/lib/api/public';
import type { DiscoverWorkshop, DiscoverResponse } from '@/lib/api/public';
import { FilterSidebar, FILTER_GROUPS } from './components/FilterSidebar';
import { SkeletonCard } from './components/SkeletonCard';
import { DiscoverHero } from '@/components/discover/DiscoverHero';
import { DiscoverSidebar } from '@/components/discover/DiscoverSidebar';
import { WorkshopCard } from '@/components/discover/WorkshopCard';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import type { FeaturedWorkshop } from '@/components/discover/DiscoverHero';

/* --- Pagination helpers ---------------------------------------------------- */

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const near = new Set(
    [1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total),
  );
  const sorted = [...near].sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('ellipsis');
    result.push(sorted[i]);
  }
  return result;
}

/* --- Date range → API params ----------------------------------------------- */

function dateRangeToApiParams(
  range: string | null,
  customFrom: string | null,
  customTo: string | null,
): { start_after?: string; start_before?: string } {
  if (!range) return {};
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  switch (range) {
    case 'next-week': {
      const end = new Date(today);
      end.setDate(today.getDate() + 7);
      return { start_after: fmt(today), start_before: fmt(end) };
    }
    case 'this-month': {
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start_after: fmt(today), start_before: fmt(end) };
    }
    case 'next-3-months': {
      const end = new Date(today);
      end.setMonth(today.getMonth() + 3);
      return { start_after: fmt(today), start_before: fmt(end) };
    }
    case 'custom':
      return {
        ...(customFrom ? { start_after: customFrom } : {}),
        ...(customTo ? { start_before: customTo } : {}),
      };
    default:
      return {};
  }
}

/* --- Workshop card data helpers -------------------------------------------- */

function computeDurationLabel(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return '';
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays <= 1) return '1 Day';
  if (diffDays <= 7) return `${diffDays} Days`;
  const weeks = Math.round(diffDays / 7);
  return `${weeks} Week${weeks > 1 ? 's' : ''}`;
}

function formatDateRange(start: string, end: string): string {
  if (!start || !end) return '';
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const startDt = new Date(sy, sm - 1, sd);
  const endDt = new Date(ey, em - 1, ed);
  if (start === end) {
    return startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (sm === em && sy === ey) {
    return `${startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${ed}, ${sy}`;
  }
  return `${startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function workshopToCardProps(w: DiscoverWorkshop) {
  const loc = w.default_location ?? w.location;
  const locationParts = [loc?.city, loc?.state_or_region].filter(Boolean);
  const formatTag = w.tags?.find((t) => t.group_key === 'format');
  const formatValue = formatTag?.label ?? formatTag?.value ?? '';
  const location =
    locationParts.length > 0
      ? locationParts.join(', ')
      : formatValue.toLowerCase().includes('virtual')
        ? 'Online'
        : 'Location TBA';

  return {
    id: w.id,
    title: w.title,
    category: w.taxonomy?.category?.name ?? w.category ?? 'Workshop',
    durationLabel: computeDurationLabel(w.start_date, w.end_date),
    imageUrl: w.hero_image_url ?? '',
    location,
    dateRange: formatDateRange(w.start_date, w.end_date),
    price: 0,
    publicSlug: w.public_slug ?? '',
    spotsLeft: w.spots_remaining ?? null,
    totalCapacity: null as number | null,
  };
}

/* --- DiscoverClient ------------------------------------------------------- */

export function DiscoverClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { categories, tagGroups, isLoading: taxonomyLoading } = useTaxonomy();

  // --- URL-derived filter state (tags, sort, pagination, search) -----------
  const q = searchParams.get('q') ?? '';
  const tags = searchParams.getAll('tag');
  const perPage = Number(searchParams.get('per_page') ?? '12') as 12 | 24 | 48;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const sort = (searchParams.get('sort') ?? 'start_date') as 'newest' | 'start_date' | 'relevance';

  // --- Right sidebar filter state (React state) ----------------------------
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [selectedSubcategorySlug, setSelectedSubcategorySlug] = useState<string | null>(null);
  const [selectedSpecializationSlug, setSelectedSpecializationSlug] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<string | null>(null);
  const [customDateFrom, setCustomDateFrom] = useState<string | null>(null);
  const [customDateTo, setCustomDateTo] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState('');
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(2500);

  // Debounced location (300ms) — avoids re-fetch on every keystroke
  const [debouncedLocation, setDebouncedLocation] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedLocation(locationQuery), 300);
    return () => clearTimeout(t);
  }, [locationQuery]);

  // --- UI state -------------------------------------------------------------
  const [filtersOpen, setFiltersOpen] = useState(false);

  // --- Featured workshop for hero ------------------------------------------
  const [featuredWorkshop, setFeaturedWorkshop] = useState<FeaturedWorkshop | null>(null);

  useEffect(() => {
    discoverWorkshopsV2({ per_page: 1, sort: 'newest' }).then((res) => {
      const w = res?.data?.[0];
      if (!w || !w.public_slug) return;
      setFeaturedWorkshop({
        id: w.id,
        title: w.title,
        description: w.description,
        imageUrl: w.hero_image_url ?? '',
        instructorAvatars: w.first_leader?.profile_image_url
          ? [w.first_leader.profile_image_url]
          : [],
        totalInstructors: w.leader_count,
        startingPrice: 0,
        publicSlug: w.public_slug,
      });
    });
  }, []);

  // --- Workshop API state ---------------------------------------------------
  const [workshops, setWorkshops] = useState<DiscoverWorkshop[]>([]);
  const [meta, setMeta] = useState<DiscoverResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // --- Fetch workshops whenever any filter changes --------------------------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const dateParams = dateRangeToApiParams(selectedDateRange, customDateFrom, customDateTo);

    discoverWorkshopsV2({
      q: q || undefined,
      category: selectedCategorySlug || undefined,
      subcategory: selectedSubcategorySlug || undefined,
      specialization: selectedSpecializationSlug || undefined,
      tags: tags.length > 0 ? tags : undefined,
      start_after: dateParams.start_after,
      start_before: dateParams.start_before,
      location: debouncedLocation.trim() || undefined,
      ...(FEATURE_FLAGS.PAYMENTS_ENABLED && priceMin > 0 ? { price_min: priceMin } : {}),
      ...(FEATURE_FLAGS.PAYMENTS_ENABLED && priceMax < 2500 ? { price_max: priceMax } : {}),
      per_page: perPage,
      page,
      sort,
    })
      .then((res) => {
        if (cancelled) return;
        setWorkshops(res?.data ?? []);
        setMeta(res?.meta ?? null);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    searchParams.toString(),
    selectedCategorySlug,
    selectedSubcategorySlug,
    selectedSpecializationSlug,
    selectedDateRange,
    customDateFrom,
    customDateTo,
    debouncedLocation,
    priceMin,
    priceMax,
  ]);

  // --- URL update helper (for tags, sort, page, q) -------------------------
  function pushParams(updates: Record<string, string | string[] | null>, resetPage = true) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') {
        p.delete(key);
      } else if (Array.isArray(value)) {
        p.delete(key);
        value.forEach((v) => p.append(key, v));
      } else {
        p.set(key, value);
      }
    }
    if (resetPage) p.delete('page');
    router.push(`/discover?${p.toString()}`);
  }

  // --- Tag toggle (used by slide-out FilterSidebar) -------------------------
  function handleTagToggle(tagSlug: string, groupKey: string, allowsMultiple: boolean) {
    const apiGroup = tagGroups.find((g) => g.key === groupKey);
    const staticGroup = FILTER_GROUPS.find((g) => g.key === groupKey);
    const groupSlugs =
      apiGroup?.tags.map((t) => t.slug) ??
      staticGroup?.options.map((o) => o.slug) ??
      [];

    let newTags: string[];
    if (allowsMultiple) {
      newTags = tags.includes(tagSlug)
        ? tags.filter((t) => t !== tagSlug)
        : [...tags, tagSlug];
    } else {
      const withoutGroup = tags.filter((t) => !groupSlugs.includes(t));
      newTags = tags.includes(tagSlug) ? withoutGroup : [...withoutGroup, tagSlug];
    }
    pushParams({ tag: newTags.length > 0 ? newTags : null });
  }

  // --- Hero search ----------------------------------------------------------
  function handleHeroSearch(query: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (query) p.set('q', query);
    else p.delete('q');
    p.delete('page');
    router.push(`/discover?${p.toString()}`);
  }

  // --- Clear all (sidebar + URL) -------------------------------------------
  function handleClearAll() {
    setSelectedCategorySlug(null);
    setSelectedSubcategorySlug(null);
    setSelectedSpecializationSlug(null);
    setSelectedDateRange(null);
    setCustomDateFrom(null);
    setCustomDateTo(null);
    setLocationQuery('');
    setPriceMin(0);
    setPriceMax(2500);
    router.push('/discover');
  }

  // --- Pagination -----------------------------------------------------------
  function handlePageChange(newPage: number) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('page', String(newPage));
    router.push(`/discover?${p.toString()}`);
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- Derived values -------------------------------------------------------
  const total = meta?.total ?? 0;
  const totalPages = meta?.last_page ?? 1;
  const pageNumbers = getPageNumbers(page, totalPages);

  // Count active filter groups in the slide-out (for badge on Filters button)
  const activeSlideOutFilterCount = FILTER_GROUPS.reduce((count, group) => {
    const hasActive = group.options.some((o) => tags.includes(o.slug));
    return hasActive ? count + 1 : count;
  }, 0);

  // Taxonomy shaped for DiscoverSidebar
  const sidebarTaxonomy = taxonomyLoading ? null : {
    categories: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      subcategories: cat.subcategories.map((sub) => ({
        id: sub.id,
        name: sub.name,
        slug: sub.slug,
        specializations: sub.specializations.map((spec) => ({
          id: spec.id,
          name: spec.name,
          slug: spec.slug,
        })),
      })),
    })),
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <DiscoverHero featuredWorkshop={featuredWorkshop} onSearch={handleHeroSearch} />

      {/* ── Content area ──────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">

        {/* Top bar: Filters button + results count + sort */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="flex items-center gap-2 border border-gray-300 rounded-xl px-4 py-2
                         text-sm font-medium text-gray-700
                         hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              <SlidersHorizontal size={15} />
              Filters
              {activeSlideOutFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full
                                 bg-[#0FA3B1] text-white text-xs font-bold ml-1">
                  {activeSlideOutFilterCount}
                </span>
              )}
            </button>
            <p className="text-sm text-gray-500">
              {!loading && (
                <>
                  <span className="font-semibold text-gray-900">{total}</span>
                  {' '}workshop{total !== 1 ? 's' : ''}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            Sort by:
            <select
              value={sort}
              onChange={(e) => pushParams({ sort: e.target.value }, false)}
              className="font-medium text-gray-900 border-none bg-transparent cursor-pointer focus:outline-none"
            >
              <option value="start_date">Start Date</option>
              <option value="newest">Newest</option>
              <option value="relevance">Most Relevant</option>
            </select>
          </div>
        </div>

        {/* Main content: sidebar above on mobile, grid left + sidebar right on desktop */}
        <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">

          {/* ── Workshop card grid ────────────────────────────────────────── */}
          <div className="flex-1 min-w-0" ref={gridRef}>

            {/* Error state */}
            {error && !loading && (
              <div className="flex flex-col items-center text-center bg-white rounded-xl border border-gray-200 p-12">
                <p className="font-[Sora] font-semibold text-gray-900 text-base mb-2">
                  Unable to load workshops. Please try again.
                </p>
                <button
                  type="button"
                  onClick={() => router.push(`/discover?${searchParams.toString()}`)}
                  className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#0FA3B1] text-white text-sm font-semibold hover:bg-[#0c8a96] transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Workshop grid */}
            {!error && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {loading
                    ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                    : workshops.map((w) => {
                        const props = workshopToCardProps(w);
                        return <WorkshopCard key={w.public_slug ?? w.id} {...props} />;
                      })}
                </div>

                {/* Empty state */}
                {!loading && workshops.length === 0 && (
                  <div className="flex flex-col items-center text-center bg-white rounded-xl border border-gray-200 p-12">
                    <p className="font-[Sora] font-semibold text-gray-900 text-base mb-2">
                      No workshops found
                    </p>
                    <p className="text-sm text-gray-500 mb-5">
                      Try adjusting your filters or check back soon.
                    </p>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white text-sm font-semibold
                                 text-gray-900 border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Clear filters
                    </button>
                  </div>
                )}

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1.5 mt-10">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => handlePageChange(page - 1)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white
                                 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {pageNumbers.map((p, i) =>
                      p === 'ellipsis' ? (
                        <span key={`ell-${i}`} className="w-9 h-9 flex items-center justify-center text-sm text-gray-400">
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handlePageChange(p)}
                          className={`w-9 h-9 flex items-center justify-center rounded-lg border text-sm font-medium transition-colors
                            ${page === p
                              ? 'bg-[#0FA3B1] text-white border-[#0FA3B1]'
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                        >
                          {p}
                        </button>
                      ),
                    )}

                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => handlePageChange(page + 1)}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white
                                 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Right sidebar ─────────────────────────────────────────────── */}
          <div className="w-full lg:w-72 lg:flex-shrink-0">
            <DiscoverSidebar
              selectedCategorySlug={selectedCategorySlug}
              selectedSubcategorySlug={selectedSubcategorySlug}
              selectedSpecializationSlug={selectedSpecializationSlug}
              onCategoryChange={setSelectedCategorySlug}
              onSubcategoryChange={setSelectedSubcategorySlug}
              onSpecializationChange={setSelectedSpecializationSlug}
              selectedDateRange={selectedDateRange}
              customDateFrom={customDateFrom}
              customDateTo={customDateTo}
              onDateRangeChange={setSelectedDateRange}
              onCustomDateChange={(from, to) => {
                setCustomDateFrom(from);
                setCustomDateTo(to);
              }}
              locationQuery={locationQuery}
              onLocationChange={setLocationQuery}
              priceMin={priceMin}
              priceMax={priceMax}
              onPriceChange={(min, max) => {
                setPriceMin(min);
                setPriceMax(max);
              }}
              taxonomy={sidebarTaxonomy}
            />
          </div>

        </div>
      </div>

      {/* ── Slide-out backdrop ────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300
          ${filtersOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setFiltersOpen(false)}
      />

      {/* ── Slide-out panel ───────────────────────────────────────────────── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-2xl overflow-y-auto
          transform transition-transform duration-300 ease-in-out
          ${filtersOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <FilterSidebar
          selectedTags={tags}
          onTagToggle={(slug, gk, multi) => handleTagToggle(slug, gk, multi)}
          priceMin={priceMin}
          priceMax={priceMax}
          onPriceChange={(min, max) => {
            setPriceMin(min);
            setPriceMax(max);
          }}
          onClose={() => setFiltersOpen(false)}
          onClearAll={() => { handleClearAll(); setFiltersOpen(false); }}
        />
      </div>

    </div>
  );
}

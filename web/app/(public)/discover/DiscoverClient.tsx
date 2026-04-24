'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { discoverWorkshopsV2 } from '@/lib/api/public';
import type { DiscoverWorkshop, DiscoverResponse } from '@/lib/api/public';
import { FilterSidebar, type ActiveFilters } from './components/FilterSidebar';
import { WorkshopCard } from './components/WorkshopCard';
import { SkeletonCard } from './components/SkeletonCard';
import { DiscoverHero } from '@/components/discover/DiscoverHero';
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

/* --- DiscoverClient ------------------------------------------------------- */

export function DiscoverClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { categories, tagGroups, isLoading: taxonomyLoading } = useTaxonomy();

  // --- Derive filter state from URL ---
  const q = searchParams.get('q') ?? '';
  const category = searchParams.get('category') ?? '';
  const subcategory = searchParams.get('subcategory') ?? '';
  const specialization = searchParams.get('specialization') ?? '';
  const tags = searchParams.getAll('tag');
  const startAfter = searchParams.get('start_after') ?? '';
  const startBefore = searchParams.get('start_before') ?? '';
  const perPage = Number(searchParams.get('per_page') ?? '12') as 12 | 24 | 48;
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const sort = (searchParams.get('sort') ?? 'start_date') as 'newest' | 'start_date' | 'relevance';

  const filters: ActiveFilters = { category, subcategory, specialization, tags, startAfter, startBefore };

  // --- Local UI state ---
  const [searchInput, setSearchInput] = useState(q);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // --- Featured workshop for hero ---
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

  // --- API state ---
  const [workshops, setWorkshops] = useState<DiscoverWorkshop[]>([]);
  const [meta, setMeta] = useState<DiscoverResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // --- Sync local search input when URL changes externally ---
  const prevQRef = useRef(q);
  useEffect(() => {
    if (q !== prevQRef.current) {
      prevQRef.current = q;
      setSearchInput(q);
    }
  }, [q]);

  // --- Debounce search input → URL (replace so history isn't spammed) ---
  const isFirstSearchRender = useRef(true);
  useEffect(() => {
    if (isFirstSearchRender.current) {
      isFirstSearchRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const p = new URLSearchParams(searchParams.toString());
      if (searchInput) p.set('q', searchInput);
      else p.delete('q');
      p.delete('page');
      router.replace(`/discover?${p.toString()}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Fetch workshops when URL params change ---
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    discoverWorkshopsV2({
      q: q || undefined,
      category: category || undefined,
      subcategory: subcategory || undefined,
      specialization: specialization || undefined,
      tags: tags.length > 0 ? tags : undefined,
      start_after: startAfter || undefined,
      start_before: startBefore || undefined,
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
  }, [searchParams.toString()]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- URL update helpers ---
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

  function handleCategoryChange(slug: string | null) {
    pushParams({ category: slug, subcategory: null, specialization: null });
  }

  function handleSubcategoryChange(slug: string | null) {
    pushParams({ subcategory: slug, specialization: null });
  }

  function handleSpecializationChange(slug: string | null) {
    pushParams({ specialization: slug });
  }

  function handleTagToggle(tagSlug: string, groupKey: string, allowsMultiple: boolean) {
    const group = tagGroups.find((g) => g.key === groupKey);
    const groupSlugs = group?.tags.map((t) => t.slug) ?? [];

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

  function handleDateChange(field: 'startAfter' | 'startBefore', value: string) {
    const key = field === 'startAfter' ? 'start_after' : 'start_before';
    pushParams({ [key]: value || null });
  }

  function handleHeroSearch(query: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (query) p.set('q', query);
    else p.delete('q');
    p.delete('page');
    router.push(`/discover?${p.toString()}`);
    setSearchInput(query);
  }

  function handleClearAll() {
    router.push('/discover');
  }

  function handlePageChange(newPage: number) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('page', String(newPage));
    router.push(`/discover?${p.toString()}`);
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // --- Derived pagination values ---
  const total = meta?.total ?? 0;
  const totalPages = meta?.last_page ?? 1;
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const pageNumbers = getPageNumbers(page, totalPages);

  const hasAnyFilter = !!category || tags.length > 0 || !!startAfter || !!startBefore || !!q;

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <DiscoverHero featuredWorkshop={featuredWorkshop} onSearch={handleHeroSearch} />

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-border-gray sticky top-14 z-30">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-3">
          <div className="flex items-center gap-3">
            {/* Mobile filters button */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border-gray
                         bg-white text-sm font-medium text-dark hover:bg-surface transition-colors shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {hasAnyFilter && (
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              )}
            </button>

            {/* Title */}
            <h1 className="font-heading font-bold text-dark text-lg hidden md:block shrink-0">
              Browse Workshops
            </h1>

            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-light-gray pointer-events-none" />
              <input
                type="search"
                placeholder="Search workshops..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-sm text-dark bg-surface border border-border-gray
                           rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                           placeholder:text-light-gray transition-colors"
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-medium-gray hidden sm:block">Sort:</span>
              <select
                value={sort}
                onChange={(e) => pushParams({ sort: e.target.value }, false)}
                className="h-9 pl-2.5 pr-7 text-sm text-dark bg-white border border-border-gray
                           rounded-lg outline-none appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="start_date">Start Date</option>
                <option value="newest">Newest</option>
                <option value="relevance">Relevance</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-6">
        <div className="flex gap-6 items-start">

          {/* ── Sidebar (desktop) ──────────────────────────────────────── */}
          <aside className="hidden md:block w-[260px] shrink-0 bg-white rounded-xl border border-border-gray overflow-hidden sticky top-[108px] max-h-[calc(100vh-124px)] overflow-y-auto">
            <div className="px-4 py-3 border-b border-border-gray">
              <h2 className="font-heading font-semibold text-sm text-dark">Filters</h2>
            </div>
            <FilterSidebar
              categories={categories}
              tagGroups={tagGroups}
              taxonomyLoading={taxonomyLoading}
              filters={filters}
              onCategoryChange={handleCategoryChange}
              onSubcategoryChange={handleSubcategoryChange}
              onSpecializationChange={handleSpecializationChange}
              onTagToggle={handleTagToggle}
              onDateChange={handleDateChange}
              onClearAll={handleClearAll}
            />
          </aside>

          {/* ── Grid area ─────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0" ref={gridRef}>
            {/* Top bar: count + per page */}
            <div className="flex items-center justify-between mb-4 gap-3">
              <p className="font-sans text-sm text-medium-gray">
                {loading ? (
                  <span className="inline-block w-40 h-4 bg-gray-200 animate-pulse rounded" />
                ) : total > 0 ? (
                  <>Showing <strong className="text-dark">{from}–{to}</strong> of <strong className="text-dark">{total}</strong> workshops</>
                ) : null}
              </p>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-sans text-xs text-medium-gray">Show:</span>
                {([12, 24, 48] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => pushParams({ per_page: String(n) })}
                    className={`w-9 h-8 text-sm font-medium rounded-lg border transition-colors
                      ${perPage === n
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-medium-gray border-border-gray hover:border-primary/40 hover:text-dark'
                      }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Error state */}
            {error && !loading && (
              <div className="flex flex-col items-center text-center bg-white rounded-xl border border-border-gray p-12">
                <p className="font-heading font-semibold text-dark text-base mb-2">
                  Unable to load workshops. Please try again.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const p = new URLSearchParams(searchParams.toString());
                    router.push(`/discover?${p.toString()}`);
                  }}
                  className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-[#0d8f9c] transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Workshop grid */}
            {!error && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {loading
                    ? Array.from({ length: perPage > 12 ? 12 : perPage }).map((_, i) => (
                        <SkeletonCard key={i} />
                      ))
                    : workshops.map((w) => (
                        <WorkshopCard key={w.public_slug ?? w.id} workshop={w} />
                      ))}
                </div>

                {/* Empty state */}
                {!loading && workshops.length === 0 && (
                  <div className="flex flex-col items-center text-center bg-white rounded-xl border border-border-gray p-12">
                    <p className="font-heading font-semibold text-dark text-base mb-2">
                      No workshops found
                    </p>
                    <p className="font-sans text-sm text-medium-gray mb-5">
                      Try adjusting your filters or check back soon.
                    </p>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white text-sm font-semibold
                                 text-dark border border-border-gray hover:bg-surface transition-colors"
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
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-border-gray bg-white
                                 text-medium-gray hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {pageNumbers.map((p, i) =>
                      p === 'ellipsis' ? (
                        <span key={`ell-${i}`} className="w-9 h-9 flex items-center justify-center text-sm text-light-gray">
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handlePageChange(p)}
                          className={`w-9 h-9 flex items-center justify-center rounded-lg border text-sm font-medium transition-colors
                            ${page === p
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white text-medium-gray border-border-gray hover:bg-surface hover:text-dark'
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
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-border-gray bg-white
                                 text-medium-gray hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile drawer backdrop ──────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300
          ${drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* ── Mobile drawer panel ─────────────────────────────────────────── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-2xl overflow-y-auto
          transform transition-transform duration-300 ease-in-out
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border-gray sticky top-0 bg-white z-10">
          <h2 className="font-heading font-bold text-dark text-base">Filters</h2>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface transition-colors"
            aria-label="Close filters"
          >
            <X className="w-4 h-4 text-medium-gray" />
          </button>
        </div>

        <FilterSidebar
          categories={categories}
          tagGroups={tagGroups}
          taxonomyLoading={taxonomyLoading}
          filters={filters}
          onCategoryChange={(slug) => { handleCategoryChange(slug); setDrawerOpen(false); }}
          onSubcategoryChange={(slug) => { handleSubcategoryChange(slug); }}
          onSpecializationChange={(slug) => { handleSpecializationChange(slug); }}
          onTagToggle={(slug, gk, multi) => { handleTagToggle(slug, gk, multi); }}
          onDateChange={(field, value) => { handleDateChange(field, value); }}
          onClearAll={() => { handleClearAll(); setDrawerOpen(false); }}
        />

        {/* Apply button */}
        <div className="px-4 py-4 border-t border-border-gray sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="w-full h-10 rounded-lg bg-primary text-white text-sm font-semibold
                       hover:bg-[#0d8f9c] transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

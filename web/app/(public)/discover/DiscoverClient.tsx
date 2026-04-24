'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { X, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useTaxonomy } from '@/hooks/useTaxonomy';
import { discoverWorkshopsV2 } from '@/lib/api/public';
import type { DiscoverWorkshop, DiscoverResponse } from '@/lib/api/public';
import { FilterSidebar, type ActiveFilters } from './components/FilterSidebar';
import { SkeletonCard } from './components/SkeletonCard';
import { DiscoverHero } from '@/components/discover/DiscoverHero';
import { DiscoverFilterBar } from '@/components/discover/DiscoverFilterBar';
import { AdvancedFiltersSidebar } from '@/components/discover/AdvancedFiltersSidebar';
import { WorkshopCard } from '@/components/discover/WorkshopCard';
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

/* --- Date helpers ---------------------------------------------------------- */

const SKILL_LEVEL_QUICK_SLUGS = ['beginner', 'intermediate', 'advanced'];

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeActiveDatePreset(startAfter: string, startBefore: string): string {
  if (!startAfter && !startBefore) return 'any';
  const today = new Date();

  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  if (startAfter === fmtDate(weekStart) && startBefore === fmtDate(weekEnd)) return 'this-week';

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  if (startAfter === fmtDate(monthStart) && startBefore === fmtDate(monthEnd)) return 'this-month';

  const threeMonthsEnd = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
  if (startAfter === fmtDate(today) && startBefore === fmtDate(threeMonthsEnd)) return 'next-3-months';

  return 'custom';
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

  // Advanced filter URL state (applied)
  const appliedDuration = searchParams.get('duration') ?? '';
  const appliedExpStyles = searchParams.getAll('exp_style');
  const appliedPriceMin = Number(searchParams.get('price_min') ?? '0');
  const appliedPriceMax = Number(searchParams.get('price_max') ?? '2500');
  const appliedGroupSize = searchParams.get('group_size') ?? '';

  const filters: ActiveFilters = { category, subcategory, specialization, tags, startAfter, startBefore };

  // --- Local UI state ---
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Advanced filter pending state (mirrors sidebar before Apply)
  const pendingAdvancedRef = useRef({
    duration: appliedDuration || undefined as string | undefined,
    experienceStyles: appliedExpStyles,
    priceMin: appliedPriceMin,
    priceMax: appliedPriceMax,
    groupSize: appliedGroupSize || undefined as string | undefined,
  });

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
  }

  function handleFilterBarDateChange(value: string, range?: { from?: string; to?: string }) {
    const today = new Date();
    if (value === 'any') {
      pushParams({ start_after: null, start_before: null });
    } else if (value === 'this-week') {
      const dow = today.getDay();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      pushParams({ start_after: fmtDate(weekStart), start_before: fmtDate(weekEnd) });
    } else if (value === 'this-month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      pushParams({ start_after: fmtDate(monthStart), start_before: fmtDate(monthEnd) });
    } else if (value === 'next-3-months') {
      const end = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
      pushParams({ start_after: fmtDate(today), start_before: fmtDate(end) });
    } else if (value === 'custom' && range) {
      pushParams({
        start_after: range.from || null,
        start_before: range.to || null,
      });
    }
  }

  function handleSkillLevelChange(value: string | null) {
    const withoutSkillLevel = tags.filter((t) => !SKILL_LEVEL_QUICK_SLUGS.includes(t));
    if (value === null) {
      pushParams({ tag: withoutSkillLevel.length > 0 ? withoutSkillLevel : null });
    } else {
      pushParams({ tag: [...withoutSkillLevel, value] });
    }
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

  // --- Advanced filter handlers --------------------------------------------

  function handleAdvancedChange(key: string, value: unknown) {
    pendingAdvancedRef.current = { ...pendingAdvancedRef.current, [key]: value };
  }

  function handleAdvancedApply() {
    const p = pendingAdvancedRef.current;
    pushParams({
      duration: p.duration || null,
      exp_style: (p.experienceStyles?.length ?? 0) > 0 ? p.experienceStyles : null,
      price_min: p.priceMin > 0 ? String(p.priceMin) : null,
      price_max: p.priceMax < 2500 ? String(p.priceMax) : null,
      group_size: p.groupSize || null,
    });
  }

  function handleAdvancedReset() {
    pendingAdvancedRef.current = {
      duration: undefined,
      experienceStyles: [],
      priceMin: 0,
      priceMax: 2500,
      groupSize: undefined,
    };
    pushParams({
      duration: null,
      exp_style: null,
      price_min: null,
      price_max: null,
      group_size: null,
    });
  }

  // --- Derived pagination values ---
  const total = meta?.total ?? 0;
  const totalPages = meta?.last_page ?? 1;
  const pageNumbers = getPageNumbers(page, totalPages);

  const hasAnyFilter = !!category || tags.length > 0 || !!startAfter || !!startBefore || !!q;
  const hasAdvancedFilters = !!appliedDuration || appliedExpStyles.length > 0 ||
    appliedPriceMin > 0 || appliedPriceMax < 2500 || !!appliedGroupSize;

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <DiscoverHero featuredWorkshop={featuredWorkshop} onSearch={handleHeroSearch} />

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <DiscoverFilterBar
        activeCategory={category || undefined}
        activeDate={computeActiveDatePreset(startAfter, startBefore)}
        activeDateRange={
          startAfter || startBefore
            ? { from: startAfter || undefined, to: startBefore || undefined }
            : undefined
        }
        activeSkillLevel={tags.find((t) => SKILL_LEVEL_QUICK_SLUGS.includes(t))}
        onCategoryChange={handleCategoryChange}
        onDateChange={handleFilterBarDateChange}
        onSkillLevelChange={handleSkillLevelChange}
        onMoreFilters={() => setDrawerOpen(true)}
        hasActiveAdvancedFilters={
          !!subcategory ||
          !!specialization ||
          tags.some((t) => !SKILL_LEVEL_QUICK_SLUGS.includes(t)) ||
          hasAdvancedFilters
        }
      />

      {/* ── Results section ─────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">

        {/* Results header row */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 font-[Sora]">
            Available Workshops{' '}
            {!loading && (
              <span className="text-gray-400 font-normal text-xl">({total})</span>
            )}
          </h2>
          <div className="flex items-center gap-3">
            {/* Mobile filters button */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200
                         bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {hasAnyFilter && (
                <span className="w-2 h-2 rounded-full bg-[#0FA3B1] shrink-0" />
              )}
            </button>

            {/* Sort select */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="hidden sm:inline">Sort by:</span>
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
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">

          {/* ── LEFT: Workshop card grid ────────────────────────────────── */}
          <div ref={gridRef}>
            {/* Error state */}
            {error && !loading && (
              <div className="flex flex-col items-center text-center bg-white rounded-xl border border-gray-200 p-12">
                <p className="font-[Sora] font-semibold text-gray-900 text-base mb-2">
                  Unable to load workshops. Please try again.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const p = new URLSearchParams(searchParams.toString());
                    router.push(`/discover?${p.toString()}`);
                  }}
                  className="mt-3 inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#0FA3B1] text-white text-sm font-semibold hover:bg-[#0c8a96] transition-colors"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Workshop grid */}
            {!error && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

          {/* ── RIGHT: Advanced Filters sidebar ─────────────────────────── */}
          <div className="hidden lg:block lg:sticky lg:top-[72px]">
            <AdvancedFiltersSidebar
              activeDuration={appliedDuration || undefined}
              activeExperienceStyles={appliedExpStyles}
              priceMin={appliedPriceMin}
              priceMax={appliedPriceMax}
              activeGroupSize={appliedGroupSize || undefined}
              onChange={handleAdvancedChange}
              onApply={handleAdvancedApply}
              onReset={handleAdvancedReset}
            />
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
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="font-[Sora] font-bold text-gray-900 text-base">Filters</h2>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close filters"
          >
            <X className="w-4 h-4 text-gray-500" />
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

        {/* Drawer apply button */}
        <div className="px-4 py-4 border-t border-gray-200 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="w-full h-10 rounded-lg bg-[#0FA3B1] text-white text-sm font-semibold
                       hover:bg-[#0c8a96] transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

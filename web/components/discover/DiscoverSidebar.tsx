'use client';

import { Search, X } from 'lucide-react';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

/* --- Types ----------------------------------------------------------------- */

interface DiscoverSidebarProps {
  // Category / subcategory / specialization
  selectedCategorySlug: string | null;
  selectedSubcategorySlug: string | null;
  selectedSpecializationSlug: string | null;
  onCategoryChange: (slug: string | null) => void;
  onSubcategoryChange: (slug: string | null) => void;
  onSpecializationChange: (slug: string | null) => void;

  // Date range
  selectedDateRange: string | null;
  customDateFrom: string | null;
  customDateTo: string | null;
  onDateRangeChange: (value: string | null) => void;
  onCustomDateChange: (from: string | null, to: string | null) => void;

  // Location
  locationQuery: string;
  onLocationChange: (value: string) => void;

  // Taxonomy data (from GET /api/v1/taxonomy)
  taxonomy: {
    categories: Array<{
      id: number;
      name: string;
      slug: string;
      subcategories: Array<{
        id: number;
        name: string;
        slug: string;
        specializations: Array<{
          id: number;
          name: string;
          slug: string;
        }>;
      }>;
    }>;
  } | null;

  // Pricing (hidden when PAYMENTS_ENABLED is false)
  priceMin: number;
  priceMax: number;
  onPriceChange: (min: number, max: number) => void;
}

/* --- Section label --------------------------------------------------------- */

function SectionLabel({ children }: { children: string }) {
  return (
    <label className="block text-[10px] font-bold tracking-[0.15em] uppercase text-gray-500 mb-2 font-mono">
      {children}
    </label>
  );
}

/* --- Shared select style --------------------------------------------------- */

const selectClass =
  'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white ' +
  'focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1] focus:outline-none cursor-pointer';

/* --- DiscoverSidebar ------------------------------------------------------- */

export function DiscoverSidebar({
  selectedCategorySlug,
  selectedSubcategorySlug,
  selectedSpecializationSlug,
  onCategoryChange,
  onSubcategoryChange,
  onSpecializationChange,
  selectedDateRange,
  customDateFrom,
  customDateTo,
  onDateRangeChange,
  onCustomDateChange,
  locationQuery,
  onLocationChange,
  taxonomy,
  priceMin,
  priceMax,
  onPriceChange,
}: DiscoverSidebarProps) {
  const selectedCategory = taxonomy?.categories.find(
    (c) => c.slug === selectedCategorySlug,
  ) ?? null;

  const hasSubcategories =
    selectedCategory !== null && selectedCategory.subcategories.length > 0;

  const selectedSubcategory = selectedCategory?.subcategories.find(
    (s) => s.slug === selectedSubcategorySlug,
  ) ?? null;

  const specializations = selectedSubcategory?.specializations ?? [];
  const hasSpecializations = specializations.length > 0;

  const hasActiveFilters =
    !!selectedCategorySlug ||
    !!selectedSubcategorySlug ||
    !!selectedSpecializationSlug ||
    !!selectedDateRange ||
    !!locationQuery ||
    (FEATURE_FLAGS.PAYMENTS_ENABLED && (priceMin > 0 || priceMax < 2500));

  function handleClearAll() {
    onCategoryChange(null);
    onSubcategoryChange(null);
    onSpecializationChange(null);
    onDateRangeChange(null);
    onCustomDateChange(null, null);
    onLocationChange('');
    if (FEATURE_FLAGS.PAYMENTS_ENABLED) {
      onPriceChange(0, 2500);
    }
  }

  return (
    <aside
      className="w-full sticky top-4 self-start max-h-none lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto"
    >
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-5">

        {/* ── SECTION 1: CATEGORY ──────────────────────────────────────── */}
        <div>
          <SectionLabel>Category</SectionLabel>
          <select
            value={selectedCategorySlug ?? ''}
            onChange={(e) => {
              onCategoryChange(e.target.value || null);
              onSubcategoryChange(null);
              onSpecializationChange(null);
            }}
            className={selectClass}
          >
            {taxonomy === null ? (
              <option value="" disabled>Loading...</option>
            ) : (
              <>
                <option value="">All Categories</option>
                {taxonomy.categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* ── SECTION 2: SUBCATEGORY (conditional) ─────────────────────── */}
        {selectedCategorySlug !== null && hasSubcategories && (
          <div>
            <SectionLabel>Subcategory</SectionLabel>
            <select
              value={selectedSubcategorySlug ?? ''}
              onChange={(e) => {
                onSubcategoryChange(e.target.value || null);
                onSpecializationChange(null);
              }}
              className={selectClass}
            >
              <option value="">All {selectedCategory!.name}</option>
              {selectedCategory!.subcategories.map((sub) => (
                <option key={sub.id} value={sub.slug}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── SECTION 2b: SPECIALIZATION (conditional) ─────────────────── */}
        {selectedSubcategorySlug !== null && hasSpecializations && (
          <div>
            <SectionLabel>Specialization</SectionLabel>
            <select
              value={selectedSpecializationSlug ?? ''}
              onChange={(e) => onSpecializationChange(e.target.value || null)}
              className={selectClass}
            >
              <option value="">All {selectedSubcategory!.name}</option>
              {specializations.map((spec) => (
                <option key={spec.id} value={spec.slug}>
                  {spec.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── SECTION 3: DATE RANGE ────────────────────────────────────── */}
        <div>
          <SectionLabel>When</SectionLabel>
          <select
            value={selectedDateRange ?? ''}
            onChange={(e) => onDateRangeChange(e.target.value || null)}
            className={selectClass}
          >
            <option value="">Any time</option>
            <option value="next-week">Next week</option>
            <option value="this-month">This month</option>
            <option value="next-3-months">Next 3 months</option>
            <option value="custom">Custom range...</option>
          </select>

          {selectedDateRange === 'custom' && (
            <div className="mt-2 space-y-2">
              <div>
                <label className="text-xs text-gray-500 block mb-1">From</label>
                <input
                  type="date"
                  value={customDateFrom || ''}
                  onChange={(e) =>
                    onCustomDateChange(e.target.value || null, customDateTo)
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-[#0FA3B1] focus:outline-none focus:ring-1 focus:ring-[#0FA3B1]"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">To</label>
                <input
                  type="date"
                  value={customDateTo || ''}
                  onChange={(e) =>
                    onCustomDateChange(customDateFrom, e.target.value || null)
                  }
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:border-[#0FA3B1] focus:outline-none focus:ring-1 focus:ring-[#0FA3B1]"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── SECTION 4: LOCATION ──────────────────────────────────────── */}
        <div>
          <SectionLabel>Location</SectionLabel>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="City or region"
              value={locationQuery}
              onChange={(e) => onLocationChange(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0FA3B1] focus:ring-1 focus:ring-[#0FA3B1] focus:outline-none"
            />
            {locationQuery && (
              <button
                type="button"
                onClick={() => onLocationChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear location"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* ── SECTION 5: PRICE RANGE (hidden unless PAYMENTS_ENABLED) ─── */}
        {FEATURE_FLAGS.PAYMENTS_ENABLED && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-500 font-mono">
                Price Range
              </label>
              <span className="text-xs font-semibold text-[#0FA3B1]">
                ${priceMin} — ${priceMax}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={2500}
              step={25}
              value={priceMin}
              onChange={(e) => onPriceChange(Number(e.target.value), priceMax)}
              className="w-full accent-[#0FA3B1]"
              aria-label="Minimum price"
            />
            <input
              type="range"
              min={0}
              max={2500}
              step={25}
              value={priceMax}
              onChange={(e) => onPriceChange(priceMin, Number(e.target.value))}
              className="w-full accent-[#0FA3B1]"
              aria-label="Maximum price"
            />
          </div>
        )}

        {/* ── SECTION 6: CLEAR ALL ─────────────────────────────────────── */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className="w-full text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl py-2 transition-colors hover:border-gray-300"
          >
            Clear all filters
          </button>
        )}

      </div>
    </aside>
  );
}

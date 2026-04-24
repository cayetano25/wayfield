'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { LayoutGrid, CalendarDays, MapPin, SlidersHorizontal, Check } from 'lucide-react';
import { useTaxonomy } from '@/hooks/useTaxonomy';

/* --- Types ----------------------------------------------------------------- */

export interface DiscoverFilterBarProps {
  activeCategory?: string;
  activeDate?: string;
  activeDateRange?: { from?: string; to?: string };
  activeSkillLevel?: string;
  onCategoryChange: (slug: string | null) => void;
  onDateChange: (value: string, range?: { from?: string; to?: string }) => void;
  onSkillLevelChange: (value: string | null) => void;
  onMoreFilters: () => void;
  hasActiveAdvancedFilters: boolean;
}

/* --- Constants ------------------------------------------------------------- */

const SKILL_LEVELS = [
  { label: 'Beginner', value: 'beginner' },
  { label: 'Intermediate', value: 'intermediate' },
  { label: 'Expert', value: 'advanced' },
] as const;

const DATE_PRESETS = [
  { label: 'Any Date', value: 'any' },
  { label: 'This Week', value: 'this-week' },
  { label: 'This Month', value: 'this-month' },
  { label: 'Next 3 Months', value: 'next-3-months' },
  { label: 'Custom Range...', value: 'custom' },
] as const;

/* --- Date pill label ------------------------------------------------------- */

function datePillLabel(activeDate?: string, activeDateRange?: { from?: string; to?: string }): string {
  if (!activeDate || activeDate === 'any') return 'Any Date';
  if (activeDate === 'this-week') return 'This Week';
  if (activeDate === 'this-month') return 'This Month';
  if (activeDate === 'next-3-months') return 'Next 3 Months';
  if (activeDate === 'custom') {
    const from = activeDateRange?.from;
    const to = activeDateRange?.to;
    if (from && to) return `${from} – ${to}`;
    if (from) return `From ${from}`;
    if (to) return `To ${to}`;
  }
  return 'Any Date';
}

/* --- Shared close-on-outside hook ----------------------------------------- */

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [ref, onClose]);
}

/* --- Pill styles ----------------------------------------------------------- */

function pillClass(active: boolean) {
  return active
    ? 'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full cursor-pointer transition-colors ' +
      'bg-[#0FA3B1] text-white border border-[#0FA3B1]'
    : 'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full cursor-pointer transition-colors ' +
      'bg-white text-gray-600 border border-gray-300 hover:border-gray-400 hover:bg-gray-50';
}

/* --- Divider --------------------------------------------------------------- */

function Divider() {
  return <div className="w-px h-5 bg-gray-300 shrink-0 mx-1" aria-hidden="true" />;
}

/* --- Category dropdown ----------------------------------------------------- */

interface CategoryDropdownProps {
  activeCategory?: string;
  onCategoryChange: (slug: string | null) => void;
  onClose: () => void;
}

function CategoryDropdown({ activeCategory, onCategoryChange, onClose }: CategoryDropdownProps) {
  const { categories, isLoading } = useTaxonomy();

  function handleSelect(slug: string | null) {
    onCategoryChange(slug);
    onClose();
  }

  return (
    <div className="absolute left-0 top-full mt-2 z-30 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[220px]">
      {/* All Categories */}
      <button
        type="button"
        onClick={() => handleSelect(null)}
        className={`flex items-center justify-between w-full px-4 py-2.5 text-sm text-left transition-colors
          ${!activeCategory
            ? 'bg-teal-50 text-teal-700 font-medium'
            : 'text-gray-700 hover:bg-gray-50'
          }`}
      >
        All Categories
        {!activeCategory && <Check size={14} className="shrink-0 text-teal-600" />}
      </button>

      <div className="my-1 h-px bg-gray-100" />

      {isLoading ? (
        <div className="px-4 py-2 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
          ))}
        </div>
      ) : (
        categories.map((cat) => {
          const isSelected = activeCategory === cat.slug;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleSelect(isSelected ? null : cat.slug)}
              className={`flex items-center justify-between w-full px-4 py-2.5 text-sm text-left transition-colors
                ${isSelected
                  ? 'bg-teal-50 text-teal-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
                }`}
            >
              {cat.name}
              {isSelected && <Check size={14} className="shrink-0 text-teal-600" />}
            </button>
          );
        })
      )}
    </div>
  );
}

/* --- Date dropdown --------------------------------------------------------- */

interface DateDropdownProps {
  activeDate?: string;
  activeDateRange?: { from?: string; to?: string };
  onDateChange: (value: string, range?: { from?: string; to?: string }) => void;
  onClose: () => void;
}

function DateDropdown({ activeDate, activeDateRange, onDateChange, onClose }: DateDropdownProps) {
  const [showCustom, setShowCustom] = useState(activeDate === 'custom');
  const [customFrom, setCustomFrom] = useState(activeDateRange?.from ?? '');
  const [customTo, setCustomTo] = useState(activeDateRange?.to ?? '');

  function handlePreset(value: string) {
    if (value === 'custom') {
      setShowCustom(true);
      return;
    }
    onDateChange(value);
    onClose();
  }

  function applyCustom() {
    onDateChange('custom', { from: customFrom || undefined, to: customTo || undefined });
    onClose();
  }

  return (
    <div className="absolute left-0 top-full mt-2 z-30 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[200px]">
      {DATE_PRESETS.map(({ label, value }) => {
        const isSelected = value === 'any'
          ? !activeDate || activeDate === 'any'
          : activeDate === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => handlePreset(value)}
            className={`flex items-center justify-between w-full px-4 py-2.5 text-sm text-left transition-colors
              ${isSelected
                ? 'bg-teal-50 text-teal-700 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
              }`}
          >
            {label}
            {isSelected && value !== 'custom' && (
              <Check size={14} className="shrink-0 text-teal-600" />
            )}
          </button>
        );
      })}

      {showCustom && (
        <div className="px-4 pt-2 pb-3 border-t border-gray-100">
          <label className="text-xs text-gray-500 mb-1 block">From</label>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2"
          />
          <label className="text-xs text-gray-500 mb-1 block">To</label>
          <input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => setCustomTo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
          />
          <button
            type="button"
            onClick={applyCustom}
            className="w-full bg-[#0FA3B1] text-white text-sm font-semibold rounded-lg py-2 hover:bg-[#0c8a96] transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

/* --- DiscoverFilterBar ----------------------------------------------------- */

export function DiscoverFilterBar({
  activeCategory,
  activeDate,
  activeDateRange,
  activeSkillLevel,
  onCategoryChange,
  onDateChange,
  onSkillLevelChange,
  onMoreFilters,
  hasActiveAdvancedFilters,
}: DiscoverFilterBarProps) {
  const { categories } = useTaxonomy();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const categoryRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  const closeCategory = useCallback(() => setCategoryOpen(false), []);
  const closeDate = useCallback(() => setDateOpen(false), []);

  useClickOutside(categoryRef, closeCategory);
  useClickOutside(dateRef, closeDate);

  /* Derive category label */
  const activeCategoryName = categories.find((c) => c.slug === activeCategory)?.name ?? null;

  /* Skill level toggle */
  function handleSkillLevel(value: string) {
    onSkillLevelChange(activeSkillLevel === value ? null : value);
  }

  /* Date pill label */
  const dateLabel = datePillLabel(activeDate, activeDateRange);
  const dateActive = !!activeDate && activeDate !== 'any';

  return (
    <div className="bg-white border-b border-gray-200 px-6 lg:px-8 py-3">
      <div className="flex flex-row items-center gap-2 flex-wrap">

        {/* ── GROUP 1: Contextual filter pills ──────────────────────────── */}

        {/* Category pill */}
        <div ref={categoryRef} className="relative">
          <button
            type="button"
            onClick={() => { setCategoryOpen((o) => !o); setDateOpen(false); }}
            className={pillClass(!!activeCategory)}
            aria-expanded={categoryOpen}
            aria-haspopup="listbox"
          >
            <LayoutGrid size={14} aria-hidden="true" />
            <span>{activeCategoryName ?? 'Category'}</span>
          </button>

          {categoryOpen && (
            <CategoryDropdown
              activeCategory={activeCategory}
              onCategoryChange={onCategoryChange}
              onClose={closeCategory}
            />
          )}
        </div>

        {/* Any Date pill */}
        <div ref={dateRef} className="relative">
          <button
            type="button"
            onClick={() => { setDateOpen((o) => !o); setCategoryOpen(false); }}
            className={pillClass(dateActive)}
            aria-expanded={dateOpen}
            aria-haspopup="listbox"
          >
            <CalendarDays size={14} aria-hidden="true" />
            <span>{dateLabel}</span>
          </button>

          {dateOpen && (
            <DateDropdown
              activeDate={activeDate}
              activeDateRange={activeDateRange}
              onDateChange={onDateChange}
              onClose={closeDate}
            />
          )}
        </div>

        {/* Global / location pill — cosmetic only in v1 */}
        <button
          type="button"
          className={pillClass(false)}
          aria-label="Filter by location (coming soon)"
        >
          <MapPin size={14} aria-hidden="true" />
          <span>Global</span>
        </button>

        <Divider />

        {/* ── GROUP 2: Skill level pills ────────────────────────────────── */}

        {SKILL_LEVELS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleSkillLevel(value)}
            className={pillClass(activeSkillLevel === value)}
            aria-pressed={activeSkillLevel === value}
          >
            {label}
          </button>
        ))}

        <Divider />

        {/* ── GROUP 3: More Filters ─────────────────────────────────────── */}

        <div className="ml-auto">
          <button
            type="button"
            onClick={onMoreFilters}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors
                       bg-white text-gray-700 border border-gray-300 hover:border-gray-400 hover:bg-gray-50 relative"
          >
            <span className="relative inline-flex">
              <SlidersHorizontal size={14} aria-hidden="true" />
              {hasActiveAdvancedFilters && (
                <span
                  className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#0FA3B1]"
                  aria-label="Advanced filters active"
                />
              )}
            </span>
            More Filters
          </button>
        </div>

      </div>
    </div>
  );
}

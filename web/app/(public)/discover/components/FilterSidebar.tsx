'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { TaxonomyCategory, TaxonomyTagGroup } from '@/lib/types/taxonomy';

/* --- Types ---------------------------------------------------------------- */

export interface ActiveFilters {
  category: string;
  subcategory: string;
  specialization: string;
  tags: string[];
  startAfter: string;
  startBefore: string;
}

interface FilterSidebarProps {
  categories: TaxonomyCategory[];
  tagGroups: TaxonomyTagGroup[];
  taxonomyLoading: boolean;
  filters: ActiveFilters;
  onCategoryChange: (slug: string | null) => void;
  onSubcategoryChange: (slug: string | null) => void;
  onSpecializationChange: (slug: string | null) => void;
  onTagToggle: (tagSlug: string, groupKey: string, allowsMultiple: boolean) => void;
  onDateChange: (field: 'startAfter' | 'startBefore', value: string) => void;
  onClearAll: () => void;
}

/* --- Sidebar tag groups to show ------------------------------------------- */

const SIDEBAR_TAG_GROUP_KEYS = [
  'skill_level',
  'format',
  'duration',
  'audience',
  'experience_style',
];

/* --- Active chips helpers ------------------------------------------------- */

function getChips(
  filters: ActiveFilters,
  categories: TaxonomyCategory[],
  tagGroups: TaxonomyTagGroup[],
): Array<{ key: string; label: string; onRemove: () => void }> {
  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

  const cat = categories.find((c) => c.slug === filters.category);
  if (cat) {
    const sub = cat.subcategories.find((s) => s.slug === filters.subcategory);
    const spec = sub?.specializations.find((sp) => sp.slug === filters.specialization);

    chips.push({ key: `cat-${cat.slug}`, label: cat.name, onRemove: () => {} });
    if (sub) chips.push({ key: `sub-${sub.slug}`, label: sub.name, onRemove: () => {} });
    if (spec) chips.push({ key: `spec-${spec.slug}`, label: spec.name, onRemove: () => {} });
  }

  for (const tagSlug of filters.tags) {
    let label = tagSlug;
    for (const group of tagGroups) {
      const tag = group.tags.find((t) => t.slug === tagSlug);
      if (tag) { label = tag.name; break; }
    }
    chips.push({ key: `tag-${tagSlug}`, label, onRemove: () => {} });
  }

  if (filters.startAfter) {
    chips.push({ key: 'start_after', label: `From: ${filters.startAfter}`, onRemove: () => {} });
  }
  if (filters.startBefore) {
    chips.push({ key: 'start_before', label: `To: ${filters.startBefore}`, onRemove: () => {} });
  }

  return chips;
}

/* --- Collapsible group wrapper -------------------------------------------- */

function FilterGroup({
  groupKey,
  label,
  expanded,
  onToggle,
  children,
}: {
  groupKey: string;
  label: string;
  expanded: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border-gray last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(groupKey)}
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-surface transition-colors"
      >
        <span className="font-sans font-semibold text-sm text-dark">{label}</span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-medium-gray shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-medium-gray shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}

/* --- Tag group filter ------------------------------------------------------ */

function TagGroupFilter({
  group,
  selectedTags,
  onTagToggle,
}: {
  group: TaxonomyTagGroup;
  selectedTags: string[];
  onTagToggle: (slug: string, groupKey: string, allowsMultiple: boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      {group.tags.map((tag) => {
        const selected = selectedTags.includes(tag.slug);
        return (
          <label
            key={tag.id}
            className="flex items-center gap-2.5 cursor-pointer group/item"
          >
            <button
              type="button"
              role={group.allows_multiple ? 'checkbox' : 'radio'}
              aria-checked={selected}
              onClick={() => onTagToggle(tag.slug, group.key, group.allows_multiple)}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                ${selected
                  ? 'bg-primary border-primary'
                  : 'bg-white border-border-gray group-hover/item:border-primary/40'
                }
                ${!group.allows_multiple ? 'rounded-full' : 'rounded'}
              `}
            >
              {selected && group.allows_multiple && (
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1.5 5l2.5 2.5 4.5-5" />
                </svg>
              )}
              {selected && !group.allows_multiple && (
                <div className="w-2 h-2 bg-white rounded-full" />
              )}
            </button>
            <span className={`font-sans text-sm transition-colors
              ${selected ? 'text-dark font-medium' : 'text-medium-gray group-hover/item:text-dark'}
            `}>
              {tag.name}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* --- FilterSidebar -------------------------------------------------------- */

export function FilterSidebar({
  categories,
  tagGroups,
  taxonomyLoading,
  filters,
  onCategoryChange,
  onSubcategoryChange,
  onSpecializationChange,
  onTagToggle,
  onDateChange,
  onClearAll,
}: FilterSidebarProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(['category', 'skill_level']),
  );

  function toggleGroup(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const hasFilters =
    !!filters.category ||
    filters.tags.length > 0 ||
    !!filters.startAfter ||
    !!filters.startBefore;

  const chips = getChips(filters, categories, tagGroups);

  const sidebarTagGroups = SIDEBAR_TAG_GROUP_KEYS
    .map((key) => tagGroups.find((g) => g.key === key))
    .filter(Boolean) as TaxonomyTagGroup[];

  const selectedCat = categories.find((c) => c.slug === filters.category);
  const selectedSub = selectedCat?.subcategories.find((s) => s.slug === filters.subcategory);

  return (
    <div className="font-sans">
      {/* Clear all */}
      {hasFilters && (
        <div className="px-4 py-3 border-b border-border-gray">
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-danger hover:text-danger/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear all
          </button>
        </div>
      )}

      {/* Active chips */}
      {chips.length > 0 && (
        <div className="px-4 py-3 border-b border-border-gray flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => {
                  if (chip.key.startsWith('cat-')) onCategoryChange(null);
                  else if (chip.key.startsWith('sub-')) onSubcategoryChange(null);
                  else if (chip.key.startsWith('spec-')) onSpecializationChange(null);
                  else if (chip.key.startsWith('tag-')) {
                    const slug = chip.key.replace('tag-', '');
                    const group = tagGroups.find((g) => g.tags.some((t) => t.slug === slug));
                    if (group) onTagToggle(slug, group.key, group.allows_multiple);
                  }
                  else if (chip.key === 'start_after') onDateChange('startAfter', '');
                  else if (chip.key === 'start_before') onDateChange('startBefore', '');
                }}
                className="text-primary/60 hover:text-primary transition-colors"
                aria-label={`Remove ${chip.label} filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Category filter */}
      <FilterGroup
        groupKey="category"
        label="Category"
        expanded={expanded.has('category')}
        onToggle={toggleGroup}
      >
        {taxonomyLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 animate-pulse rounded w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {categories.map((cat) => {
              const isSelected = filters.category === cat.slug;
              return (
                <div key={cat.id}>
                  <button
                    type="button"
                    onClick={() => onCategoryChange(isSelected ? null : cat.slug)}
                    className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm transition-colors
                      ${isSelected
                        ? 'text-primary font-semibold bg-primary/5 border-l-2 border-primary pl-1.5'
                        : 'text-medium-gray hover:text-dark hover:bg-surface'
                      }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-primary' : 'bg-border-gray'}`} />
                    {cat.name}
                  </button>

                  {/* Subcategories */}
                  {isSelected && cat.subcategories.length > 0 && (
                    <div className="ml-4 mt-0.5 space-y-0.5">
                      {cat.subcategories.map((sub) => {
                        const subSelected = filters.subcategory === sub.slug;
                        return (
                          <div key={sub.id}>
                            <button
                              type="button"
                              onClick={() => onSubcategoryChange(subSelected ? null : sub.slug)}
                              className={`flex items-center gap-2 w-full text-left px-2 py-1 rounded text-xs transition-colors
                                ${subSelected
                                  ? 'text-primary font-semibold bg-primary/5 border-l-2 border-primary pl-1.5'
                                  : 'text-medium-gray hover:text-dark hover:bg-surface'
                                }`}
                            >
                              <span className={`w-1 h-1 rounded-full shrink-0 ${subSelected ? 'bg-primary' : 'bg-border-gray'}`} />
                              {sub.name}
                            </button>

                            {/* Specializations */}
                            {subSelected && sub.specializations.length > 0 && (
                              <div className="ml-4 mt-0.5 space-y-0.5">
                                {sub.specializations.map((spec) => {
                                  const specSelected = filters.specialization === spec.slug;
                                  return (
                                    <button
                                      key={spec.id}
                                      type="button"
                                      onClick={() => onSpecializationChange(specSelected ? null : spec.slug)}
                                      className={`flex items-center gap-2 w-full text-left px-2 py-1 rounded text-xs transition-colors
                                        ${specSelected
                                          ? 'text-primary font-medium bg-primary/5'
                                          : 'text-medium-gray hover:text-dark hover:bg-surface'
                                        }`}
                                    >
                                      <span className={`w-1 h-1 rounded-full shrink-0 ${specSelected ? 'bg-primary' : 'bg-border-gray'}`} />
                                      {spec.name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </FilterGroup>

      {/* Tag group filters */}
      {sidebarTagGroups.map((group) => (
        <FilterGroup
          key={group.key}
          groupKey={group.key}
          label={group.label}
          expanded={expanded.has(group.key)}
          onToggle={toggleGroup}
        >
          <TagGroupFilter
            group={group}
            selectedTags={filters.tags}
            onTagToggle={onTagToggle}
          />
        </FilterGroup>
      ))}

      {/* Date range */}
      <FilterGroup
        groupKey="when"
        label="When"
        expanded={expanded.has('when')}
        onToggle={toggleGroup}
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-medium-gray">From</label>
            <input
              type="date"
              value={filters.startAfter}
              onChange={(e) => onDateChange('startAfter', e.target.value)}
              className="w-full h-9 px-2.5 text-sm text-dark bg-white border border-border-gray
                         rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-medium-gray">To</label>
            <input
              type="date"
              value={filters.startBefore}
              min={filters.startAfter || undefined}
              onChange={(e) => onDateChange('startBefore', e.target.value)}
              className="w-full h-9 px-2.5 text-sm text-dark bg-white border border-border-gray
                         rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          {(filters.startAfter || filters.startBefore) && (
            <button
              type="button"
              onClick={() => { onDateChange('startAfter', ''); onDateChange('startBefore', ''); }}
              className="text-xs text-medium-gray hover:text-dark transition-colors"
            >
              Clear dates
            </button>
          )}
        </div>
      </FilterGroup>
    </div>
  );
}

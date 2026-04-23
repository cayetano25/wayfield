'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import type { TaxonomyCategory, TaxonomyTagGroup } from '@/lib/types/taxonomy';

const PRIMARY_TAG_GROUP_KEYS = [
  'skill_level',
  'format',
  'duration',
  'audience',
  'experience_style',
  'group_size',
];

interface TaxonomySectionProps {
  categories: TaxonomyCategory[];
  tagGroups: TaxonomyTagGroup[];
  isLoading: boolean;
  categoryId: number | null;
  subcategoryId: number | null;
  specializationId: number | null;
  tagIds: number[];
  onCategoryChange: (id: number | null) => void;
  onSubcategoryChange: (id: number | null) => void;
  onSpecializationChange: (id: number | null) => void;
  onTagIdsChange: (ids: number[]) => void;
}

export function TaxonomySection({
  categories,
  tagGroups,
  isLoading,
  categoryId,
  subcategoryId,
  specializationId,
  tagIds,
  onCategoryChange,
  onSubcategoryChange,
  onSpecializationChange,
  onTagIdsChange,
}: TaxonomySectionProps) {
  const [showMore, setShowMore] = useState(false);

  const availableSubcategories = useMemo(() => {
    if (!categoryId) return [];
    return categories.find((c) => c.id === categoryId)?.subcategories ?? [];
  }, [categories, categoryId]);

  const availableSpecializations = useMemo(() => {
    if (!subcategoryId) return [];
    return availableSubcategories.find((s) => s.id === subcategoryId)?.specializations ?? [];
  }, [availableSubcategories, subcategoryId]);

  const sortedTagGroups = useMemo(
    () => [...(tagGroups ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [tagGroups],
  );

  const primaryTagGroups = useMemo(
    () =>
      PRIMARY_TAG_GROUP_KEYS
        .map((key) => sortedTagGroups.find((g) => g.key === key))
        .filter(Boolean) as TaxonomyTagGroup[],
    [sortedTagGroups],
  );

  const secondaryTagGroups = useMemo(
    () => sortedTagGroups.filter((g) => !PRIMARY_TAG_GROUP_KEYS.includes(g.key)),
    [sortedTagGroups],
  );

  function handleTagClick(tagId: number, group: TaxonomyTagGroup) {
    if (group.allows_multiple) {
      const next = tagIds.includes(tagId)
        ? tagIds.filter((id) => id !== tagId)
        : [...tagIds, tagId];
      onTagIdsChange(next);
    } else {
      const groupTagIds = group.tags.map((t) => t.id);
      const withoutGroup = tagIds.filter((id) => !groupTagIds.includes(id));
      if (tagIds.includes(tagId)) {
        onTagIdsChange(withoutGroup);
      } else {
        onTagIdsChange([...withoutGroup, tagId]);
      }
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border-gray shadow-[0px_12px_32px_rgba(46,46,46,0.06)]">
      <div className="px-6 py-5 border-b border-border-gray">
        <h2 className="font-heading text-base font-semibold text-dark">Category &amp; Discovery</h2>
        <p className="text-sm text-medium-gray mt-0.5">
          Help participants find your workshop in search and browse.
        </p>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Cascading selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="Category"
            value={categoryId ?? ''}
            disabled={isLoading}
            onChange={(e) => {
              const val = e.target.value;
              onCategoryChange(val ? Number(val) : null);
            }}
          >
            <option value="">{isLoading ? 'Loading…' : 'Select a category'}</option>
            {[...categories]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
          </Select>

          <Select
            label="Subcategory"
            value={subcategoryId ?? ''}
            disabled={!categoryId || isLoading}
            onChange={(e) => {
              const val = e.target.value;
              onSubcategoryChange(val ? Number(val) : null);
            }}
          >
            <option value="">
              {!categoryId ? 'Select a category first' : 'Select a subcategory'}
            </option>
            {availableSubcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </Select>

          <Select
            label="Specialization"
            value={specializationId ?? ''}
            disabled={!subcategoryId || isLoading}
            onChange={(e) => {
              const val = e.target.value;
              onSpecializationChange(val ? Number(val) : null);
            }}
          >
            <option value="">
              {!subcategoryId ? 'Select a subcategory first' : 'Select a specialization'}
            </option>
            {availableSpecializations.map((spec) => (
              <option key={spec.id} value={spec.id}>
                {spec.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Primary tag groups */}
        {primaryTagGroups.length > 0 && (
          <div className="space-y-5">
            {primaryTagGroups.map((group) => (
              <TagGroupField
                key={group.key}
                group={group}
                tagIds={tagIds}
                onTagClick={handleTagClick}
              />
            ))}
          </div>
        )}

        {/* Show more / fewer toggle */}
        {secondaryTagGroups.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {showMore ? (
                <>
                  Fewer options
                  <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  More discovery options
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ${
                showMore ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="space-y-5 pt-1">
                {secondaryTagGroups.map((group) => (
                  <TagGroupField
                    key={group.key}
                    group={group}
                    tagIds={tagIds}
                    onTagClick={handleTagClick}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TagGroupField — renders a single tag group as pill-buttons.
// Single-select groups behave like radio buttons.
// Multi-select groups behave like checkboxes.
// ---------------------------------------------------------------------------

interface TagGroupFieldProps {
  group: TaxonomyTagGroup;
  tagIds: number[];
  onTagClick: (tagId: number, group: TaxonomyTagGroup) => void;
}

function TagGroupField({ group, tagIds, onTagClick }: TagGroupFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-dark">
        {group.label}
        {!group.allows_multiple && (
          <span className="ml-1.5 text-xs font-normal text-medium-gray">(select one)</span>
        )}
      </span>
      <div className="flex flex-wrap gap-2">
        {group.tags.map((tag) => {
          const selected = tagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onTagClick(tag.id, group)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium
                transition-colors duration-150
                ${
                  selected
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-dark border-border-gray hover:border-primary/50 hover:text-primary'
                }
              `}
            >
              {group.allows_multiple && selected && (
                <CheckIcon className="w-3.5 h-3.5 shrink-0" />
              )}
              {tag.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 6l3 3 5-5" />
    </svg>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Info,
  User,
  BookOpen,
  Briefcase,
  Palette,
  Compass,
  Heart,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import type { TaxonomyCategory, TaxonomyTagGroup } from '@/lib/types/taxonomy';

interface Props {
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

const SKILL_LEVEL_OPTIONS = [
  { display: 'Beginner', tagName: 'Beginner' },
  { display: 'Intermediate', tagName: 'Intermediate' },
  { display: 'Advanced', tagName: 'Advanced' },
  { display: 'All Levels', tagName: 'All Levels' },
];

const AUDIENCE_OPTIONS: { display: string; tagName: string; Icon: LucideIcon }[] = [
  { display: 'Adults', tagName: 'Adults', Icon: User },
  { display: 'Kids', tagName: 'Kids', Icon: BookOpen },
  { display: 'Teens', tagName: 'Teens', Icon: GraduationCap },
  { display: 'Professionals', tagName: 'Professionals', Icon: Briefcase },
  { display: 'Creatives', tagName: 'Creatives', Icon: Palette },
  { display: 'Hobbyists', tagName: 'Hobbyists', Icon: Compass },
  { display: 'Seniors', tagName: 'Seniors', Icon: Heart },
];

export function AboutThisWorkshopCard({
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
}: Props) {
  const [selectedSkillLevel, setSelectedSkillLevel] = useState<string | null>(null);
  const [selectedAudience, setSelectedAudience] = useState<string[]>([]);

  const availableSubcategories = useMemo(() => {
    if (!categoryId) return [];
    return categories.find((c) => c.id === categoryId)?.subcategories ?? [];
  }, [categories, categoryId]);

  const availableSpecializations = useMemo(() => {
    if (!subcategoryId) return [];
    return availableSubcategories.find((s) => s.id === subcategoryId)?.specializations ?? [];
  }, [availableSubcategories, subcategoryId]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );

  // Pre-populate local state from tagIds once taxonomy loads (edit mode)
  useEffect(() => {
    if (!tagGroups.length || tagIds.length === 0) return;

    if (selectedSkillLevel === null) {
      const skillGroup = tagGroups.find((g) => g.key === 'skill_level');
      if (skillGroup) {
        const match = SKILL_LEVEL_OPTIONS.find((o) => {
          const t = skillGroup.tags.find((t) => t.name === o.tagName);
          return t && tagIds.includes(t.id);
        });
        if (match) setSelectedSkillLevel(match.tagName);
      }
    }

    if (selectedAudience.length === 0) {
      const audGroup = tagGroups.find((g) => g.key === 'audience');
      if (audGroup) {
        const matches = AUDIENCE_OPTIONS
          .filter((o) => {
            const t = audGroup.tags.find((t) => t.name === o.tagName);
            return t && tagIds.includes(t.id);
          })
          .map((o) => o.tagName);
        if (matches.length) setSelectedAudience(matches);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagGroups.length]);

  function toggleSkillLevel(tagName: string) {
    const newSelected = selectedSkillLevel === tagName ? null : tagName;
    setSelectedSkillLevel(newSelected);

    const group = tagGroups.find((g) => g.key === 'skill_level');
    if (!group) return;
    const groupTagIds = group.tags.map((t) => t.id);
    const withoutGroup = tagIds.filter((id) => !groupTagIds.includes(id));
    if (newSelected) {
      const tag = group.tags.find((t) => t.name === newSelected);
      onTagIdsChange(tag ? [...withoutGroup, tag.id] : withoutGroup);
    } else {
      onTagIdsChange(withoutGroup);
    }
  }

  function toggleAudience(tagName: string) {
    const isSelected = selectedAudience.includes(tagName);
    setSelectedAudience((prev) =>
      isSelected ? prev.filter((n) => n !== tagName) : [...prev, tagName],
    );

    const tag = tagGroups.find((g) => g.key === 'audience')?.tags.find((t) => t.name === tagName);
    if (!tag) return;
    onTagIdsChange(isSelected ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id]);
  }

  return (
    <Card className="p-6">
      {/* Card header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-50">
          <Info size={20} className="text-blue-500" />
        </div>
        <div>
          <h2 className="font-heading text-base font-semibold text-dark">About This Workshop</h2>
          <p className="text-xs font-medium text-gray-500 mt-0.5">
            Classification
          </p>
        </div>
      </div>

      {/* Category */}
      <div className="mb-6">
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Category
        </p>
        <Select
          value={categoryId ?? ''}
          disabled={isLoading}
          onChange={(e) => {
            const val = e.target.value;
            onCategoryChange(val ? Number(val) : null);
          }}
        >
          <option value="">{isLoading ? 'Loading…' : 'Select a category'}</option>
          {sortedCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Subcategory */}
      <div className="mb-6">
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Subcategory
        </p>
        <Select
          value={subcategoryId ?? ''}
          disabled={!categoryId || isLoading}
          onChange={(e) => {
            const val = e.target.value;
            onSubcategoryChange(val ? Number(val) : null);
          }}
        >
          <option value="">{!categoryId ? 'Select a category first' : 'Select a subcategory'}</option>
          {availableSubcategories.map((sub) => (
            <option key={sub.id} value={sub.id}>
              {sub.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Specialization — only when options exist */}
      {availableSpecializations.length > 0 && (
        <div className="mb-6">
          <p className="block text-sm font-medium text-gray-700 mb-2">
            Specialization
          </p>
          <Select
            value={specializationId ?? ''}
            disabled={!subcategoryId || isLoading}
            onChange={(e) => {
              const val = e.target.value;
              onSpecializationChange(val ? Number(val) : null);
            }}
          >
            <option value="">Select a specialization</option>
            {availableSpecializations.map((spec) => (
              <option key={spec.id} value={spec.id}>
                {spec.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Skill Level — 2×2 grid, single-select */}
      <div className="mb-6">
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Skill Level
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SKILL_LEVEL_OPTIONS.map((opt) => {
            const selected = selectedSkillLevel === opt.tagName;
            return (
              <button
                key={opt.tagName}
                type="button"
                onClick={() => toggleSkillLevel(opt.tagName)}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                  selected
                    ? 'bg-[#0FA3B1] text-white border-[#0FA3B1]'
                    : 'border-gray-200 text-gray-700 bg-white hover:border-[#0FA3B1] hover:text-[#0FA3B1]'
                }`}
              >
                {opt.display}
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Audience — flex wrap, multi-select with icons */}
      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Target Audience
        </p>
        <div className="flex flex-row flex-wrap gap-2">
          {AUDIENCE_OPTIONS.map(({ display, tagName, Icon }) => {
            const selected = selectedAudience.includes(tagName);
            return (
              <button
                key={tagName}
                type="button"
                onClick={() => toggleAudience(tagName)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                  selected
                    ? 'bg-[#0FA3B1] text-white border-[#0FA3B1]'
                    : 'border-gray-200 text-gray-700 bg-white hover:border-[#0FA3B1] hover:text-[#0FA3B1]'
                }`}
              >
                <Icon size={13} />
                <span>{display}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

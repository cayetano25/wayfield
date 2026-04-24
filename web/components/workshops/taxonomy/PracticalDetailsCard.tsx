'use client';

import { useState, useEffect } from 'react';
import { CalendarCheck, Snowflake, CloudRain, Sun, Leaf, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { TaxonomyTagGroup } from '@/lib/types/taxonomy';

interface Props {
  tagGroups: TaxonomyTagGroup[];
  tagIds: number[];
  onTagIdsChange: (ids: number[]) => void;
}

const DURATION_OPTIONS = [
  { display: 'Half Day', tagName: 'half_day' },
  { display: 'Full Day', tagName: 'full_day' },
  { display: 'Weekend', tagName: 'weekend' },
  { display: 'Multi-Day', tagName: 'multi_day_3_5_days' },
];

const GROUP_SIZE_OPTIONS = [
  { display: '1–4', tagName: 'solo_1on1' },
  { display: '5–10', tagName: 'small_6_12' },
  { display: '11–20', tagName: 'medium_13_25' },
  { display: '20+', tagName: 'large_26_50' },
];

const PRICE_MODEL_OPTIONS = [
  { display: 'Free', tagName: 'free' },
  { display: 'Paid', tagName: 'fixed_price' },
];

const ACCESSIBILITY_OPTIONS = [
  { value: 'wheelchair_accessible', label: 'Wheelchair Accessible', description: 'Venue and all activities are wheelchair accessible' },
  { value: 'low_sensory', label: 'Low Sensory', description: 'Reduced noise, lighting, and sensory stimulation' },
  { value: 'neurodivergent_friendly', label: 'Neurodivergent-Friendly', description: 'Environment adapted for neurodivergent participants' },
  { value: 'interpreter_available', label: 'Interpreter Available', description: 'Sign language or language interpretation available' },
  { value: 'closed_captioning', label: 'Closed Captioning', description: 'Live captions or captioned materials provided' },
  { value: 'service_animals_welcome', label: 'Service Animals Welcome', description: 'Service animals are welcome at this workshop' },
  { value: 'child_care_available', label: 'Child Care Available', description: 'Child care available during the workshop' },
  { value: 'sliding_scale_pricing', label: 'Sliding Scale Pricing', description: 'Flexible pricing based on ability to pay' },
  { value: 'free_or_subsidized', label: 'Free or Subsidized', description: 'Workshop is free or subsidized for qualifying participants' },
  { value: 'mobility_friendly', label: 'Mobility-Friendly', description: 'Accessible for participants with mobility limitations' },
  { value: 'vision_accessible_materials', label: 'Vision-Accessible Materials', description: 'Large print, digital, or alternative formats available' },
];

const SEASON_OPTIONS: { label: string; tagName: string; season: string; Icon: LucideIcon }[] = [
  { label: 'Winter', tagName: 'winter', season: 'winter', Icon: Snowflake },
  { label: 'Spring', tagName: 'spring', season: 'spring', Icon: CloudRain },
  { label: 'Summer', tagName: 'summer', season: 'summer', Icon: Sun },
  { label: 'Autumn', tagName: 'fall_autumn', season: 'autumn', Icon: Leaf },
];

export function PracticalDetailsCard({ tagGroups, tagIds, onTagIdsChange }: Props) {
  const [selectedDuration, setSelectedDuration] = useState<string | null>(null);
  const [selectedGroupSize, setSelectedGroupSize] = useState<string | null>(null);
  const [selectedPriceModel, setSelectedPriceModel] = useState<string | null>(null);
  const [selectedAccessibility, setSelectedAccessibility] = useState<string[]>([]);
  // Summer maps to the "Summer" tag; Winter/Spring/Autumn all map to "Seasonal"
  // so local state is needed to know which icon to highlight
  const [activeSeason, setActiveSeason] = useState<string | null>(null);

  // Pre-populate all local state from tagIds once taxonomy loads (edit mode)
  useEffect(() => {
    if (!tagGroups.length || tagIds.length === 0) return;

    if (selectedDuration === null) {
      const group = tagGroups.find((g) => g.key === 'duration');
      if (group) {
        const match = DURATION_OPTIONS.find((o) => {
          const t = group.tags.find((t) => t.value === o.tagName);
          return t && tagIds.includes(t.id);
        });
        if (match) setSelectedDuration(match.display);
      }
    }

    if (selectedGroupSize === null) {
      const group = tagGroups.find((g) => g.key === 'group_size');
      if (group) {
        const match = GROUP_SIZE_OPTIONS.find((o) => {
          const t = group.tags.find((t) => t.value === o.tagName);
          return t && tagIds.includes(t.id);
        });
        if (match) setSelectedGroupSize(match.display);
      }
    }

    if (selectedPriceModel === null) {
      const group = tagGroups.find((g) => g.key === 'price_model');
      if (group) {
        const match = PRICE_MODEL_OPTIONS.find((o) => {
          const t = group.tags.find((t) => t.value === o.tagName);
          return t && tagIds.includes(t.id);
        });
        if (match) setSelectedPriceModel(match.display);
      }
    }

    if (selectedAccessibility.length === 0) {
      const group = tagGroups.find((g) => g.key === 'accessibility');
      if (group) {
        const matches = ACCESSIBILITY_OPTIONS.filter((o) => {
          const t = group.tags.find((t) => t.value === o.value);
          return t && tagIds.includes(t.id);
        }).map((o) => o.value);
        if (matches.length) setSelectedAccessibility(matches);
      }
    }

    if (activeSeason === null) {
      const group = tagGroups.find((g) => g.key === 'seasonality');
      if (group) {
        const match = SEASON_OPTIONS.find((o) => {
          const t = group.tags.find((t) => t.value === o.tagName);
          return t && tagIds.includes(t.id);
        });
        if (match) setActiveSeason(match.season);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagGroups.length, tagIds.length]);

  function toggleDuration(display: string, tagName: string) {
    const newSelected = selectedDuration === display ? null : display;
    setSelectedDuration(newSelected);
    const group = tagGroups.find((g) => g.key === 'duration');
    if (!group) return;
    const groupTagIds = group.tags.map((t) => t.id);
    const withoutGroup = tagIds.filter((id) => !groupTagIds.includes(id));
    if (newSelected) {
      const tag = group.tags.find((t) => t.value === tagName);
      onTagIdsChange(tag ? [...withoutGroup, tag.id] : withoutGroup);
    } else {
      onTagIdsChange(withoutGroup);
    }
  }

  function toggleGroupSize(display: string, tagName: string) {
    const newSelected = selectedGroupSize === display ? null : display;
    setSelectedGroupSize(newSelected);
    const group = tagGroups.find((g) => g.key === 'group_size');
    if (!group) return;
    const groupTagIds = group.tags.map((t) => t.id);
    const withoutGroup = tagIds.filter((id) => !groupTagIds.includes(id));
    if (newSelected) {
      const tag = group.tags.find((t) => t.value === tagName);
      onTagIdsChange(tag ? [...withoutGroup, tag.id] : withoutGroup);
    } else {
      onTagIdsChange(withoutGroup);
    }
  }

  function togglePriceModel(display: string, tagName: string) {
    const newSelected = selectedPriceModel === display ? null : display;
    setSelectedPriceModel(newSelected);
    const group = tagGroups.find((g) => g.key === 'price_model');
    if (!group) return;
    const groupTagIds = group.tags.map((t) => t.id);
    const withoutGroup = tagIds.filter((id) => !groupTagIds.includes(id));
    if (newSelected) {
      const tag = group.tags.find((t) => t.value === tagName);
      onTagIdsChange(tag ? [...withoutGroup, tag.id] : withoutGroup);
    } else {
      onTagIdsChange(withoutGroup);
    }
  }

  function toggleAccessibility(value: string) {
    const isSelected = selectedAccessibility.includes(value);
    setSelectedAccessibility((prev) =>
      isSelected ? prev.filter((v) => v !== value) : [...prev, value],
    );
    const tag = tagGroups.find((g) => g.key === 'accessibility')?.tags.find((t) => t.value === value);
    if (!tag) return;
    onTagIdsChange(isSelected ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id]);
  }

  function toggleSeason(season: string, tagName: string) {
    const group = tagGroups.find((g) => g.key === 'seasonality');
    if (!group) return;

    const seasonTagIds = SEASON_OPTIONS
      .map((opt) => group.tags.find((t) => t.value === opt.tagName)?.id)
      .filter((id): id is number => id !== undefined);

    if (activeSeason === season) {
      setActiveSeason(null);
      onTagIdsChange(tagIds.filter((id) => !seasonTagIds.includes(id)));
    } else {
      setActiveSeason(season);
      const tag = group.tags.find((t) => t.value === tagName);
      const withoutSeasons = tagIds.filter((id) => !seasonTagIds.includes(id));
      onTagIdsChange(tag ? [...withoutSeasons, tag.id] : withoutSeasons);
    }
  }

  return (
    <Card className="p-6">
      {/* Card header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-50">
          <CalendarCheck size={20} className="text-[#E67E22]" />
        </div>
        <div>
          <h2 className="font-heading text-base font-semibold text-dark">Practical Details</h2>
          <p className="text-xs font-medium text-gray-500 mt-0.5">
            Logistics & Reach
          </p>
        </div>
      </div>

      {/* Duration — 2×2 grid, single-select */}
      <div className="mb-6">
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Duration
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DURATION_OPTIONS.map(({ display, tagName }) => {
            const selected = selectedDuration === display;
            return (
              <button
                key={display}
                type="button"
                onClick={() => toggleDuration(display, tagName)}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                  selected
                    ? 'bg-[#0FA3B1] text-white border-[#0FA3B1]'
                    : 'border-gray-200 text-gray-700 bg-white hover:border-[#0FA3B1] hover:text-[#0FA3B1]'
                }`}
              >
                {display}
              </button>
            );
          })}
        </div>
      </div>

      {/* Group Size — 4 pills, single-select */}
      <div className="mb-6">
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Group Size
        </p>
        <div className="grid grid-cols-4 gap-2">
          {GROUP_SIZE_OPTIONS.map(({ display, tagName }) => {
            const selected = selectedGroupSize === display;
            return (
              <button
                key={display}
                type="button"
                onClick={() => toggleGroupSize(display, tagName)}
                className={`px-2 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer text-center ${
                  selected
                    ? 'bg-[#0FA3B1] text-white border-[#0FA3B1]'
                    : 'border-gray-200 text-gray-700 bg-white hover:border-[#0FA3B1] hover:text-[#0FA3B1]'
                }`}
              >
                {display}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price Model — 2 pills side by side, single-select */}
      <div className="mb-6">
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Price Model
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PRICE_MODEL_OPTIONS.map(({ display, tagName }) => {
            const selected = selectedPriceModel === display;
            return (
              <button
                key={display}
                type="button"
                onClick={() => togglePriceModel(display, tagName)}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                  selected
                    ? 'bg-[#0FA3B1] text-white border-[#0FA3B1]'
                    : 'border-gray-200 text-gray-700 bg-white hover:border-[#0FA3B1] hover:text-[#0FA3B1]'
                }`}
              >
                {display}
              </button>
            );
          })}
        </div>
      </div>

      {/* Accessibility — multi-select pills, 10 options */}
      <div className="mb-6">
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Accessibility
        </p>
        <div className="flex flex-row flex-wrap gap-2">
          {ACCESSIBILITY_OPTIONS.map((opt) => {
            const selected = selectedAccessibility.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                title={opt.description}
                onClick={() => toggleAccessibility(opt.value)}
                className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition-colors cursor-pointer ${
                  selected
                    ? 'bg-[#0FA3B1] text-white border-[#0FA3B1]'
                    : 'border-gray-200 text-gray-600 bg-white hover:border-[#0FA3B1] hover:text-[#0FA3B1]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seasonality — icon-only single-select with circular buttons */}
      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Seasonality
        </p>
        <div className="flex flex-row gap-3">
          {SEASON_OPTIONS.map(({ label, tagName, season, Icon }) => (
            <button
              key={season}
              type="button"
              aria-label={label}
              onClick={() => toggleSeason(season, tagName)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors border-2 ${
                activeSeason === season
                  ? 'border-[#0FA3B1] bg-[#0FA3B1]/10 text-[#0FA3B1]'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
              }`}
            >
              <Icon size={22} />
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

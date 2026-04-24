'use client';

import { useState, useEffect } from 'react';
import {
  Mountain,
  Camera,
  Pencil,
  School,
  MessageCircle,
  Users,
  Leaf,
  Building2,
  Home,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { TaxonomyTagGroup } from '@/lib/types/taxonomy';

interface Props {
  tagGroups: TaxonomyTagGroup[];
  tagIds: number[];
  onTagIdsChange: (ids: number[]) => void;
}

const LEARNING_FORMAT_OPTIONS: { display: string; tagName: string; Icon: LucideIcon }[] = [
  { display: 'Field Shooting', tagName: 'Hands-On', Icon: Camera },
  { display: 'Editing', tagName: 'Immersive', Icon: Pencil },
  { display: 'Classroom', tagName: 'Lecture-Based', Icon: School },
  { display: 'Critique', tagName: 'Critique-Based', Icon: MessageCircle },
  { display: 'Mentorship', tagName: 'Collaborative', Icon: Users },
];

const ENVIRONMENT_OPTIONS: { display: string; tagName: string; Icon: LucideIcon }[] = [
  { display: 'Outdoor (Nature)', tagName: 'Outdoor', Icon: Leaf },
  { display: 'Outdoor (Urban)', tagName: 'On-Location', Icon: Building2 },
  { display: 'Indoor (Studio)', tagName: 'Indoor', Icon: Home },
];

const EXPERIENCE_STYLE_RADIO_OPTIONS = [
  { display: 'Structured', tagName: 'Lecture-Based' },
  { display: 'Guided + Flexible', tagName: 'Guided Practice' },
  { display: 'Exploratory', tagName: 'Hands-On' },
];
const EXPERIENCE_STYLE_RADIO_TAG_NAMES = EXPERIENCE_STYLE_RADIO_OPTIONS.map((o) => o.tagName);

const PACE_OPTIONS = [
  { display: 'Relaxed', tagName: 'Introductory' },
  { display: 'Moderate', tagName: 'Standard Pace' },
  { display: 'Intensive', tagName: 'Fast-Paced' },
];

export function ExperienceDetailsCard({ tagGroups, tagIds, onTagIdsChange }: Props) {
  const [selectedLearningFormats, setSelectedLearningFormats] = useState<string[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string | null>(null);
  const [selectedExperienceStyle, setSelectedExperienceStyle] = useState<string | null>(null);
  const [selectedPace, setSelectedPace] = useState<string | null>(null);

  // Pre-populate local state from tagIds once taxonomy loads (edit mode)
  useEffect(() => {
    if (!tagGroups.length || tagIds.length === 0) return;

    const esGroup = tagGroups.find((g) => g.key === 'experience_style');
    if (esGroup) {
      if (selectedLearningFormats.length === 0) {
        const matches = LEARNING_FORMAT_OPTIONS
          .filter((o) => {
            const t = esGroup.tags.find((t) => t.value === o.tagName);
            return t && tagIds.includes(t.id);
          })
          .map((o) => o.tagName);
        if (matches.length) setSelectedLearningFormats(matches);
      }
      if (selectedExperienceStyle === null) {
        const match = EXPERIENCE_STYLE_RADIO_OPTIONS.find((o) => {
          const t = esGroup.tags.find((t) => t.value === o.tagName);
          return t && tagIds.includes(t.id);
        });
        if (match) setSelectedExperienceStyle(match.tagName);
      }
    }

    if (selectedEnvironment === null) {
      const envGroup = tagGroups.find((g) => g.key === 'environment');
      if (envGroup) {
        const match = ENVIRONMENT_OPTIONS.find((o) => {
          const t = envGroup.tags.find((t) => t.value === o.tagName);
          return t && tagIds.includes(t.id);
        });
        if (match) setSelectedEnvironment(match.tagName);
      }
    }

    if (selectedPace === null) {
      const paceGroup = tagGroups.find((g) => g.key === 'pace');
      if (paceGroup) {
        const match = PACE_OPTIONS.find((o) => {
          const t = paceGroup.tags.find((t) => t.value === o.tagName);
          return t && tagIds.includes(t.id);
        });
        if (match) setSelectedPace(match.tagName);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagGroups.length]);

  function toggleLearningFormat(tagName: string) {
    const isSelected = selectedLearningFormats.includes(tagName);
    setSelectedLearningFormats((prev) =>
      isSelected ? prev.filter((n) => n !== tagName) : [...prev, tagName],
    );
    const tag = tagGroups
      .find((g) => g.key === 'experience_style')
      ?.tags.find((t) => t.value === tagName);
    if (!tag) return;
    onTagIdsChange(isSelected ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id]);
  }

  function toggleEnvironment(tagName: string) {
    const newSelected = selectedEnvironment === tagName ? null : tagName;
    setSelectedEnvironment(newSelected);
    const group = tagGroups.find((g) => g.key === 'environment');
    if (!group) return;
    const groupTagIds = group.tags.map((t) => t.id);
    const withoutGroup = tagIds.filter((id) => !groupTagIds.includes(id));
    if (newSelected) {
      const tag = group.tags.find((t) => t.value === newSelected);
      onTagIdsChange(tag ? [...withoutGroup, tag.id] : withoutGroup);
    } else {
      onTagIdsChange(withoutGroup);
    }
  }

  function toggleExperienceStyle(tagName: string) {
    const newSelected = selectedExperienceStyle === tagName ? null : tagName;
    setSelectedExperienceStyle(newSelected);
    const group = tagGroups.find((g) => g.key === 'experience_style');
    if (!group) return;
    const radioIds = EXPERIENCE_STYLE_RADIO_TAG_NAMES
      .map((n) => group.tags.find((t) => t.value === n)?.id)
      .filter((id): id is number => id !== undefined);
    const withoutRadios = tagIds.filter((id) => !radioIds.includes(id));
    if (newSelected) {
      const tag = group.tags.find((t) => t.value === newSelected);
      onTagIdsChange(tag ? [...withoutRadios, tag.id] : withoutRadios);
    } else {
      onTagIdsChange(withoutRadios);
    }
  }

  function togglePace(tagName: string) {
    const newSelected = selectedPace === tagName ? null : tagName;
    setSelectedPace(newSelected);
    const group = tagGroups.find((g) => g.key === 'pace');
    if (!group) return;
    const groupTagIds = group.tags.map((t) => t.id);
    const withoutGroup = tagIds.filter((id) => !groupTagIds.includes(id));
    if (newSelected) {
      const tag = group.tags.find((t) => t.value === newSelected);
      onTagIdsChange(tag ? [...withoutGroup, tag.id] : withoutGroup);
    } else {
      onTagIdsChange(withoutGroup);
    }
  }

  return (
    <Card className="p-6">
      {/* Card header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-teal-50">
          <Mountain size={20} className="text-[#0FA3B1]" />
        </div>
        <div>
          <h2 className="font-heading text-base font-semibold text-dark">Experience Details</h2>
          <p className="text-xs font-medium text-gray-500 mt-0.5">
            Format & Style
          </p>
        </div>
      </div>

      {/* Learning Format — multi-select pills with icons */}
      <div className="mb-6">
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Learning Format
        </p>
        <div className="flex flex-row flex-wrap gap-2">
          {LEARNING_FORMAT_OPTIONS.map(({ display, tagName, Icon }) => {
            const selected = selectedLearningFormats.includes(tagName);
            return (
              <button
                key={tagName}
                type="button"
                onClick={() => toggleLearningFormat(tagName)}
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

      {/* Environment — single-select pills with icons */}
      <div className="mb-6">
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Environment
        </p>
        <div className="flex flex-row flex-wrap gap-2">
          {ENVIRONMENT_OPTIONS.map(({ display, tagName, Icon }) => {
            const selected = selectedEnvironment === tagName;
            return (
              <button
                key={tagName}
                type="button"
                onClick={() => toggleEnvironment(tagName)}
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

      {/* Experience Style — custom radio buttons, single-select */}
      <div className="mb-6">
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Experience Style
        </p>
        <div className="flex flex-col gap-2">
          {EXPERIENCE_STYLE_RADIO_OPTIONS.map(({ display, tagName }) => {
            const selected = selectedExperienceStyle === tagName;
            return (
              <button
                key={tagName}
                type="button"
                onClick={() => toggleExperienceStyle(tagName)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selected
                    ? 'border-[#0FA3B1] bg-teal-50/40'
                    : 'border-gray-200 hover:border-[#0FA3B1]/50'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selected ? 'border-[#0FA3B1]' : 'border-gray-300'
                  }`}
                >
                  {selected && <div className="w-2 h-2 rounded-full bg-[#0FA3B1]" />}
                </div>
                <span className="text-sm text-gray-700 font-medium">{display}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pace — 3-pill row, single-select */}
      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">
          Pace
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PACE_OPTIONS.map(({ display, tagName }) => {
            const selected = selectedPace === tagName;
            return (
              <button
                key={tagName}
                type="button"
                onClick={() => togglePace(tagName)}
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
    </Card>
  );
}

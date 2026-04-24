'use client';

import { Check, X } from 'lucide-react';
import { FEATURE_FLAGS } from '@/lib/featureFlags';

/* --- Types ----------------------------------------------------------------- */

export interface FilterSidebarProps {
  selectedTags: string[];
  onTagToggle: (slug: string, groupKey: string, allowsMultiple: boolean) => void;
  priceMin: number;
  priceMax: number;
  onPriceChange: (min: number, max: number) => void;
  onClose: () => void;
  onClearAll: () => void;
}

/* --- Static filter group config ------------------------------------------- */

export interface FilterOption {
  label: string;
  slug: string;
}

export interface FilterGroupConfig {
  key: string;
  label: string;
  description: string;
  allowsMultiple: boolean;
  options: FilterOption[];
}

export const FILTER_GROUPS: FilterGroupConfig[] = [
  {
    key: 'skill_level',
    label: 'Skill Level',
    description: 'How much prior experience participants need.',
    allowsMultiple: false,
    options: [
      { label: 'Beginner', slug: 'beginner' },
      { label: 'Beginner-Friendly', slug: 'beginner-friendly' },
      { label: 'Intermediate', slug: 'intermediate' },
      { label: 'Advanced', slug: 'advanced' },
      { label: 'All Levels', slug: 'all-levels' },
    ],
  },
  {
    key: 'format',
    label: 'Format',
    description: 'Whether the workshop is in-person, online, or both.',
    allowsMultiple: false,
    options: [
      { label: 'In-Person', slug: 'in-person' },
      { label: 'Virtual', slug: 'virtual' },
      { label: 'Hybrid', slug: 'hybrid' },
      { label: 'Self-Paced', slug: 'self-paced' },
      { label: 'Live Instruction', slug: 'live-instruction' },
    ],
  },
  {
    key: 'duration',
    label: 'Duration',
    description: 'How long the workshop runs.',
    allowsMultiple: false,
    options: [
      { label: 'Single Session', slug: 'single-session' },
      { label: 'Multi-Day', slug: 'multi-day' },
      { label: 'Weekend Workshop', slug: 'weekend-workshop' },
      { label: 'Intensive', slug: 'intensive' },
      { label: 'Retreat', slug: 'retreat' },
      { label: 'Ongoing Series', slug: 'ongoing-series' },
    ],
  },
  {
    key: 'experience_style',
    label: 'Experience Style',
    description: 'The learning approach used.',
    allowsMultiple: true,
    options: [
      { label: 'Hands-On', slug: 'hands-on' },
      { label: 'Lecture-Based', slug: 'lecture-based' },
      { label: 'Guided Practice', slug: 'guided-practice' },
      { label: 'Critique-Based', slug: 'critique-based' },
      { label: 'Collaborative', slug: 'collaborative' },
      { label: 'Immersive', slug: 'immersive' },
    ],
  },
  {
    key: 'group_size',
    label: 'Group Size',
    description: 'The typical number of participants.',
    allowsMultiple: false,
    options: [
      { label: '1-on-1', slug: '1-on-1' },
      { label: 'Small Group', slug: 'small-group' },
      { label: 'Large Group', slug: 'large-group' },
    ],
  },
  {
    key: 'environment',
    label: 'Environment',
    description: 'The setting — indoor, outdoor, studio, or on location.',
    allowsMultiple: false,
    options: [
      { label: 'Indoor', slug: 'indoor' },
      { label: 'Outdoor', slug: 'outdoor' },
      { label: 'Studio-Based', slug: 'studio-based' },
      { label: 'On-Location', slug: 'on-location' },
      { label: 'Travel-Based', slug: 'travel-based' },
    ],
  },
  {
    key: 'goals_outcomes',
    label: 'Goals & Outcomes',
    description: 'What participants can expect to take away.',
    allowsMultiple: true,
    options: [
      { label: 'Portfolio Building', slug: 'portfolio-building' },
      { label: 'Skill Development', slug: 'skill-development' },
      { label: 'Certification', slug: 'certification' },
      { label: 'Creative Exploration', slug: 'creative-exploration' },
      { label: 'Business Growth', slug: 'business-growth' },
    ],
  },
  {
    key: 'accessibility',
    label: 'Accessibility',
    description: 'Accommodations or features offered.',
    allowsMultiple: true,
    options: [
      { label: 'Wheelchair Accessible', slug: 'wheelchair-accessible' },
      { label: 'Captioned', slug: 'captioned' },
      { label: 'ASL Available', slug: 'asl-available' },
      { label: 'Low-Sensory', slug: 'low-sensory' },
      { label: 'Accessible Materials', slug: 'accessible-materials' },
    ],
  },
  {
    key: 'booking_context',
    label: 'Booking Context',
    description: 'The type of group or occasion this workshop suits.',
    allowsMultiple: false,
    options: [
      { label: 'Open Enrollment', slug: 'open-enrollment' },
      { label: 'Private Group', slug: 'private-group' },
      { label: 'Corporate Team-Building', slug: 'corporate-team-building' },
      { label: 'Birthday Event', slug: 'birthday-event' },
      { label: 'School Program', slug: 'school-program' },
      { label: 'Festival Activity', slug: 'festival-activity' },
    ],
  },
];

/* --- Pill button ----------------------------------------------------------- */

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'bg-[#0FA3B1] text-white border border-[#0FA3B1] rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer'
          : 'border border-gray-200 text-gray-700 bg-white rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer hover:border-[#0FA3B1] hover:text-[#0FA3B1] transition-colors'
      }
    >
      {label}
    </button>
  );
}

/* --- Checkbox option ------------------------------------------------------- */

function CheckboxOption({
  label,
  checked,
  onClick,
}: {
  label: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer py-1" onClick={onClick}>
      <div
        className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
          ${checked ? 'bg-[#0FA3B1] border-[#0FA3B1]' : 'border-gray-300 hover:border-[#0FA3B1]'}`}
      >
        {checked && <Check size={10} color="white" strokeWidth={3} />}
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

/* --- FilterSidebar --------------------------------------------------------- */

export function FilterSidebar({
  selectedTags,
  onTagToggle,
  priceMin,
  priceMax,
  onPriceChange,
  onClose,
  onClearAll,
}: FilterSidebarProps) {
  const activeGroupCount = FILTER_GROUPS.reduce((count, group) => {
    const hasActive = group.options.some((o) => selectedTags.includes(o.slug));
    return hasActive ? count + 1 : count;
  }, 0);

  const activeFilterCount =
    activeGroupCount +
    (FEATURE_FLAGS.PAYMENTS_ENABLED && (priceMin > 0 || priceMax < 2500) ? 1 : 0);

  return (
    <>
      {/* ── Header (sticky) ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">Filters</h2>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0FA3B1] text-white text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Close filters">
          <X size={20} className="text-gray-500 hover:text-gray-700" />
        </button>
      </div>

      {/* ── Filter group sections ────────────────────────────────────── */}
      <div className="px-6 py-5 space-y-6">

        {FILTER_GROUPS.map((group) => (
          <div key={group.key} className="mb-6">
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-500 mb-1 font-mono">
              {group.label}
            </p>
            <p className="text-xs text-gray-400 mb-3">{group.description}</p>

            {group.allowsMultiple ? (
              /* Multi-select: checkboxes */
              <div>
                {group.options.map((opt) => (
                  <CheckboxOption
                    key={opt.slug}
                    label={opt.label}
                    checked={selectedTags.includes(opt.slug)}
                    onClick={() => onTagToggle(opt.slug, group.key, true)}
                  />
                ))}
              </div>
            ) : (
              /* Single-select: pill buttons */
              <div className="flex flex-row flex-wrap gap-2">
                {group.options.map((opt) => (
                  <Pill
                    key={opt.slug}
                    label={opt.label}
                    active={selectedTags.includes(opt.slug)}
                    onClick={() => onTagToggle(opt.slug, group.key, false)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* ── Price Range (hidden unless PAYMENTS_ENABLED) ─────────── */}
        {FEATURE_FLAGS.PAYMENTS_ENABLED && (
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-500 mb-1 font-mono">
                Price Range
              </p>
              <span className="text-xs font-semibold text-[#0FA3B1]">
                ${priceMin} — ${priceMax}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-3">Filter by registration price.</p>
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

        {/* ── Clear all ────────────────────────────────────────────── */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="w-full text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl py-2 transition-colors hover:border-gray-300"
          >
            Clear all filters
          </button>
        )}

      </div>
    </>
  );
}

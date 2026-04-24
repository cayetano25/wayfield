'use client';

import { useState, useEffect } from 'react';
import { RotateCcw, Check } from 'lucide-react';

/* --- Types ----------------------------------------------------------------- */

export interface AdvancedFilterState {
  duration?: string;
  experienceStyles: string[];
  priceMin: number;
  priceMax: number;
  groupSize?: string;
}

export interface AdvancedFiltersSidebarProps {
  activeDuration?: string;
  activeExperienceStyles: string[];
  priceMin: number;
  priceMax: number;
  activeGroupSize?: string;
  onChange: (key: string, value: unknown) => void;
  onApply: () => void;
  onReset: () => void;
}

/* --- Constants ------------------------------------------------------------- */

const PRICE_FULL_MIN = 0;
const PRICE_FULL_MAX = 5000;

const DURATION_OPTIONS = [
  { label: 'Single Day', value: 'single_day' },
  { label: 'Weekend', value: 'weekend' },
  { label: 'Full Week', value: 'full_week' },
  { label: 'Multi-week', value: 'multi_week' },
] as const;

const EXPERIENCE_OPTIONS = [
  { label: 'Hands-on Workshop', value: 'hands_on' },
  { label: 'Guided Expedition', value: 'guided_expedition' },
  { label: 'Masterclass Lecture', value: 'lecture_based' },
] as const;

const GROUP_SIZE_OPTIONS = [
  { label: 'Solo', value: 'solo' },
  { label: '4–8', value: '4-8' },
  { label: '15+', value: '15+' },
] as const;

/* --- Section heading ------------------------------------------------------- */

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-gray-500 mb-3 font-[JetBrains_Mono]">
      {children}
    </p>
  );
}

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
          ? 'bg-[#0FA3B1] text-white border border-[#0FA3B1] rounded-lg py-2 text-center text-sm font-medium cursor-pointer transition-colors'
          : 'border border-gray-200 text-sm text-gray-600 rounded-lg py-2 text-center cursor-pointer hover:border-[#0FA3B1] hover:text-[#0FA3B1] transition-colors font-medium'
      }
    >
      {label}
    </button>
  );
}

/* --- AdvancedFiltersSidebar ----------------------------------------------- */

export function AdvancedFiltersSidebar({
  activeDuration,
  activeExperienceStyles,
  priceMin,
  priceMax,
  activeGroupSize,
  onChange,
  onApply,
  onReset,
}: AdvancedFiltersSidebarProps) {
  const [localDuration, setLocalDuration] = useState<string | undefined>(activeDuration);
  const [localStyles, setLocalStyles] = useState<string[]>(activeExperienceStyles);
  const [localPriceMin, setLocalPriceMin] = useState(priceMin);
  const [localPriceMax, setLocalPriceMax] = useState(priceMax);
  const [localGroupSize, setLocalGroupSize] = useState<string | undefined>(activeGroupSize);

  // Sync when parent resets or external navigation changes applied values
  useEffect(() => {
    setLocalDuration(activeDuration);
    setLocalStyles(activeExperienceStyles);
    setLocalPriceMin(priceMin);
    setLocalPriceMax(priceMax);
    setLocalGroupSize(activeGroupSize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDuration, activeExperienceStyles.join(','), priceMin, priceMax, activeGroupSize]);

  /* --- Handlers ----------------------------------------------------------- */

  function handleDuration(value: string) {
    const next = localDuration === value ? undefined : value;
    setLocalDuration(next);
    onChange('duration', next);
  }

  function handleStyle(value: string) {
    const next = localStyles.includes(value)
      ? localStyles.filter((s) => s !== value)
      : [...localStyles, value];
    setLocalStyles(next);
    onChange('experienceStyles', next);
  }

  function handlePriceMin(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.min(Number(e.target.value), localPriceMax - 50);
    setLocalPriceMin(v);
    onChange('priceMin', v);
  }

  function handlePriceMax(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.max(Number(e.target.value), localPriceMin + 50);
    setLocalPriceMax(v);
    onChange('priceMax', v);
  }

  function handleGroupSize(value: string) {
    const next = localGroupSize === value ? undefined : value;
    setLocalGroupSize(next);
    onChange('groupSize', next);
  }

  /* --- Derived slider positions ------------------------------------------ */

  const minPct =
    ((localPriceMin - PRICE_FULL_MIN) / (PRICE_FULL_MAX - PRICE_FULL_MIN)) * 100;
  const maxPct =
    ((localPriceMax - PRICE_FULL_MIN) / (PRICE_FULL_MAX - PRICE_FULL_MIN)) * 100;

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-bold text-gray-900 font-[Sora]">Advanced Filters</h3>
          <p className="text-xs text-gray-400 mt-0.5">Refine your atelier search</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Reset filters"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* ── DURATION ────────────────────────────────────────────────────── */}
      <SectionLabel>Duration</SectionLabel>
      <div className="grid grid-cols-2 gap-2 mb-6">
        {DURATION_OPTIONS.map(({ label, value }) => (
          <Pill
            key={value}
            label={label}
            active={localDuration === value}
            onClick={() => handleDuration(value)}
          />
        ))}
      </div>

      {/* ── EXPERIENCE STYLE ──────────────────────────────────────────── */}
      <SectionLabel>Experience Style</SectionLabel>
      <div className="space-y-2.5 mb-6">
        {EXPERIENCE_OPTIONS.map(({ label, value }) => {
          const checked = localStyles.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => handleStyle(value)}
              className="flex items-center gap-3 cursor-pointer group w-full text-left"
            >
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                  ${checked
                    ? 'bg-[#0FA3B1] border-[#0FA3B1]'
                    : 'border-gray-300 group-hover:border-[#0FA3B1]'
                  }`}
              >
                {checked && <Check size={10} color="white" strokeWidth={3} />}
              </div>
              <span className="text-sm text-gray-700">{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── PRICE RANGE ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <SectionLabel>Price Range</SectionLabel>
        <span className="text-xs text-[#0FA3B1] font-medium -mt-3">
          ${localPriceMin.toLocaleString()} — ${localPriceMax.toLocaleString()}
        </span>
      </div>

      {/* Dual-range slider */}
      <div className="relative h-5 mt-2 mb-6">
        {/* Gray track background */}
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 rounded-full" />
        {/* Teal active track */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 bg-[#0FA3B1] rounded-full"
          style={{ left: `${minPct}%`, right: `${100 - maxPct}%` }}
        />
        {/* Min handle */}
        <input
          type="range"
          min={PRICE_FULL_MIN}
          max={PRICE_FULL_MAX}
          step={50}
          value={localPriceMin}
          onChange={handlePriceMin}
          className="price-range-input"
          aria-label="Minimum price"
        />
        {/* Max handle */}
        <input
          type="range"
          min={PRICE_FULL_MIN}
          max={PRICE_FULL_MAX}
          step={50}
          value={localPriceMax}
          onChange={handlePriceMax}
          className="price-range-input"
          aria-label="Maximum price"
        />
      </div>

      {/* ── MAX GROUP SIZE ────────────────────────────────────────────── */}
      <SectionLabel>Max Group Size</SectionLabel>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {GROUP_SIZE_OPTIONS.map(({ label, value }) => (
          <Pill
            key={value}
            label={label}
            active={localGroupSize === value}
            onClick={() => handleGroupSize(value)}
          />
        ))}
      </div>

      {/* ── APPLY BUTTON ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onApply}
        className="w-full bg-[#0FA3B1] hover:bg-[#0c8a96] text-white font-semibold text-sm py-3 rounded-xl transition-colors font-[Plus_Jakarta_Sans]"
      >
        Apply Filters
      </button>
    </div>
  );
}

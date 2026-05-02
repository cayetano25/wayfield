'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  workshopTitle: string;
  selectedCount: number;
  requiredCount: number;
  onConfirm: () => void;
}

export function SelectionPageHeader({
  workshopTitle,
  selectedCount,
  requiredCount,
  onConfirm,
}: Props) {
  const router = useRouter();

  return (
    <div className="sticky top-14 z-20 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center h-14 gap-4">

          {/* Back button */}
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600
              transition-colors flex-shrink-0"
            aria-label="Back"
          >
            <ChevronLeft size={18} />
          </button>

          {/* Workshop name — full, not truncated */}
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-gray-900 truncate font-[Sora]">
              {workshopTitle}
            </h1>
            <p className="text-[11px] text-gray-400 font-[JetBrains_Mono] uppercase tracking-wide">
              Select Sessions
            </p>
          </div>

          {/* Selection counter + confirm button */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-gray-500 font-[JetBrains_Mono] whitespace-nowrap">
              {selectedCount} of {requiredCount} selected
            </span>

            <button
              type="button"
              onClick={selectedCount >= requiredCount ? onConfirm : undefined}
              disabled={selectedCount < requiredCount}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap
                ${selectedCount >= requiredCount
                  ? 'bg-[#0FA3B1] text-white hover:bg-[#0c8a96]'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
            >
              Confirm Selections
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

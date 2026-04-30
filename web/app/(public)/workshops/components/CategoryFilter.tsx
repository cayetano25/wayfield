'use client';

import { useRouter } from 'next/navigation';

const CATEGORIES = ['All', 'Photography', 'Education', 'Nature'];

interface CategoryFilterProps {
  activeCategory: string;
  currentParams: Record<string, string>;
}

export function CategoryFilter({ activeCategory, currentParams }: CategoryFilterProps) {
  const router = useRouter();

  function select(cat: string) {
    const params = new URLSearchParams(currentParams);
    if (cat === 'All') {
      params.delete('category');
    } else {
      params.set('category', cat);
    }
    // Reset to page 1 when changing category
    params.delete('page');
    const qs = params.toString();
    router.push(`/workshops${qs ? `?${qs}` : ''}`);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {CATEGORIES.map((cat) => {
        const isActive = cat === 'All' ? activeCategory === 'All' : activeCategory === cat;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => select(cat)}
            className="font-sans font-semibold transition-colors"
            style={{
              fontSize: 13,
              padding: '7px 16px',
              borderRadius: 9999,
              backgroundColor: isActive ? '#0FA3B1' : 'white',
              color: isActive ? 'white' : '#374151',
              border: isActive ? '1px solid #0FA3B1' : '1px solid #E5E7EB',
              cursor: 'pointer',
            }}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}

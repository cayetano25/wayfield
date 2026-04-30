'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, AlertCircle } from 'lucide-react';
import { getFavoriteWorkshops } from '@/lib/api/favorites';
import { WorkshopCard } from '@/components/discover/WorkshopCard';
import { Button } from '@/components/ui/Button';
import type { DiscoverWorkshop } from '@/lib/api/public';

/* --- Helpers ---------------------------------------------------------------- */

function computeDurationLabel(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return '';
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays <= 1) return '1 Day';
  if (diffDays <= 7) return `${diffDays} Days`;
  const weeks = Math.round(diffDays / 7);
  return `${weeks} Week${weeks > 1 ? 's' : ''}`;
}

function formatDateRange(start: string, end: string): string {
  if (!start || !end) return '';
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const startDt = new Date(sy, sm - 1, sd);
  const endDt = new Date(ey, em - 1, ed);
  if (start === end) {
    return startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (sm === em && sy === ey) {
    return `${startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${ed}, ${sy}`;
  }
  return `${startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function workshopToCardProps(w: DiscoverWorkshop) {
  const loc = w.default_location ?? w.location;
  const locationParts = [loc?.city, loc?.state_or_region].filter(Boolean);
  const formatTag = w.tags?.find((t) => t.group_key === 'format');
  const formatValue = formatTag?.label ?? formatTag?.value ?? '';
  const location =
    locationParts.length > 0
      ? locationParts.join(', ')
      : formatValue.toLowerCase().includes('virtual')
        ? 'Online'
        : 'Location TBA';

  return {
    id: w.id,
    title: w.title,
    category: w.taxonomy?.category?.name ?? w.category ?? 'Workshop',
    durationLabel: computeDurationLabel(w.start_date, w.end_date),
    imageUrl: w.hero_image_url ?? '',
    location,
    dateRange: formatDateRange(w.start_date, w.end_date),
    price: w.pricing ? w.pricing.current_price_cents / 100 : 0,
    publicSlug: w.public_slug ?? '',
    orgId: w.organization?.id,
    orgSlug: w.organization?.slug,
    spotsLeft: w.spots_remaining ?? null,
    totalCapacity: null as number | null,
    isFavorited: true,
    participantStatus: w.participant_status ?? null,
  };
}

/* --- Skeleton --------------------------------------------------------------- */

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-3 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-4/5" />
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}

/* --- Empty state ------------------------------------------------------------ */

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <Heart className="text-gray-400" size={28} />
      </div>
      <h2 className="font-semibold text-gray-900 mb-2 font-[Sora]">No saved workshops yet</h2>
      <p className="text-sm text-gray-500 mb-6">
        Browse workshops and tap ♥ to save them here.
      </p>
      <Link
        href="/workshops"
        className="bg-[#0FA3B1] text-white font-medium px-5 py-2.5 rounded-xl text-sm hover:bg-[#0c8a96] transition-colors"
      >
        Browse Workshops
      </Link>
    </div>
  );
}

/* --- Error state ------------------------------------------------------------ */

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-white flex flex-col items-center text-center gap-4 rounded-xl p-12">
      <AlertCircle className="w-10 h-10 text-[#E94F37]" />
      <div>
        <p className="font-heading font-semibold mb-1 text-[#2E2E2E]">
          Could not load your saved workshops
        </p>
        <p className="font-sans text-sm text-gray-500">
          Check your connection and try again.
        </p>
      </div>
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/* --- Page ------------------------------------------------------------------- */

export default function FavoritesPage() {
  const [workshops, setWorkshops] = useState<DiscoverWorkshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchFavorites = useCallback(() => {
    setLoading(true);
    setError(false);
    getFavoriteWorkshops()
      .then((res) => setWorkshops(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const isEmpty = !loading && !error && workshops.length === 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora] mb-1">
          Saved Workshops
        </h1>
        <p className="text-sm text-gray-500">
          Workshops you have saved for later.
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <ErrorState onRetry={fetchFavorites} />
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {workshops.map((w) => (
            <WorkshopCard key={w.id} {...workshopToCardProps(w)} />
          ))}
        </div>
      )}
    </div>
  );
}

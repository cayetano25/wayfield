'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MapPin, CalendarDays, Heart, ArrowRight, Lock } from 'lucide-react';

/* --- Types ----------------------------------------------------------------- */

export interface WorkshopCardProps {
  id: number;
  title: string;
  category: string;
  durationLabel: string;
  imageUrl: string;
  location: string;
  dateRange: string;
  price: number;
  publicSlug: string;
  spotsLeft?: number | null;
  totalCapacity?: number | null;
  isFavorited?: boolean;
  isWaitlistOnly?: boolean;
  onFavoriteToggle?: (id: number) => void;
}

/* --- Status badge ---------------------------------------------------------- */

function StatusBadge({
  spotsLeft,
  totalCapacity,
}: {
  spotsLeft?: number | null;
  totalCapacity?: number | null;
}) {
  if (spotsLeft == null || totalCapacity == null) return null;

  if (spotsLeft === 0) {
    return (
      <span className="absolute top-3 left-3 bg-gray-900 text-white text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full font-[JetBrains_Mono]">
        Fully Booked
      </span>
    );
  }

  const isAlmostFull = totalCapacity > 0 && spotsLeft <= totalCapacity * 0.2;

  if (isAlmostFull) {
    return (
      <span className="absolute top-3 left-3 bg-[#E67E22] text-white text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full font-[JetBrains_Mono]">
        Only {spotsLeft} Left
      </span>
    );
  }

  return (
    <span className="absolute top-3 left-3 bg-[#0FA3B1] text-white text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full font-[JetBrains_Mono]">
      {spotsLeft} Spots Left
    </span>
  );
}

/* --- WorkshopCard ---------------------------------------------------------- */

export function WorkshopCard({
  id,
  title,
  category,
  durationLabel,
  imageUrl,
  location,
  dateRange,
  price,
  publicSlug,
  spotsLeft,
  totalCapacity,
  isFavorited = false,
  isWaitlistOnly = false,
  onFavoriteToggle,
}: WorkshopCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group">
      {/* Image area */}
      <div className="relative h-48">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0FA3B1] to-[#0c6b75]" />
        )}

        <StatusBadge spotsLeft={spotsLeft} totalCapacity={totalCapacity} />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFavoriteToggle?.(id);
          }}
          className="absolute top-3 right-3 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-sm transition-colors"
          aria-label={isFavorited ? 'Remove from favourites' : 'Add to favourites'}
        >
          <Heart
            size={15}
            className={isFavorited ? 'text-[#E94F37] fill-[#E94F37]' : 'text-gray-500'}
          />
        </button>
      </div>

      {/* Card body */}
      <div className="p-4">
        {/* Eyebrow: category · duration */}
        <p className="text-[10px] font-semibold tracking-widest uppercase text-gray-400 mb-2 font-[JetBrains_Mono]">
          {category} · {durationLabel}
        </p>

        {/* Title */}
        <h3 className="font-bold text-gray-900 leading-snug mb-3 line-clamp-2 font-[Sora] text-[15px]">
          {title}
        </h3>

        {/* Location + Date row */}
        <div className="flex flex-col gap-1 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin size={11} className="shrink-0" />
            <span>{location}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <CalendarDays size={11} className="shrink-0" />
            <span>{dateRange}</span>
          </div>
        </div>

        {/* Price + CTA row */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="font-bold text-gray-900 text-base">
            {price > 0 ? `$${price.toLocaleString()}` : 'Free'}
          </span>
          {isWaitlistOnly ? (
            <span className="text-gray-400 text-sm flex items-center gap-1.5">
              Waitlist Only <Lock size={12} />
            </span>
          ) : (
            <Link
              href={`/w/${publicSlug}`}
              className="text-[#0FA3B1] font-semibold text-sm flex items-center gap-1 hover:gap-2 transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              View Workshop <ArrowRight size={13} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

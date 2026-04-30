'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, CalendarDays, Heart, ArrowRight, Lock, ShoppingBag, Check, Loader2 } from 'lucide-react';
import { useOptionalCart } from '@/contexts/CartContext';
import { ApiError } from '@/lib/api/client';

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
  orgId?: number;
  orgSlug?: string;
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

/* --- Cart icon button ------------------------------------------------------- */

function CartButton({
  workshopId,
  orgId,
  orgSlug,
  publicSlug,
}: {
  workshopId: number;
  orgId: number;
  orgSlug: string;
  publicSlug: string;
}) {
  const cart = useOptionalCart();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const inCart = cart?.cart?.items.some((item) => item.workshop_id === workshopId) ?? false;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (inCart) {
      cart?.openCart();
      return;
    }

    if (!cart) return;

    setLoading(true);
    try {
      await cart.addWorkshop(orgId, workshopId, orgSlug);
      cart.openCart();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push(`/login?return=/w/${publicSlug}`);
      } else if (err instanceof ApiError && err.status === 409) {
        // Already in cart (e.g. after page refresh) — sync state then show cart
        await cart.refreshCart(orgId, orgSlug);
        cart.openCart();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label={inCart ? 'View cart' : 'Add to cart'}
      className="flex items-center justify-center rounded-xl transition-all active:scale-95"
      style={{
        width: 36,
        height: 36,
        minWidth: 36,
        backgroundColor: inCart ? '#ECFDF5' : '#0FA3B1',
        border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        flexShrink: 0,
      }}
    >
      {loading ? (
        <Loader2 size={15} color={inCart ? '#065F46' : '#ffffff'} style={{ animation: 'spin 1s linear infinite' }} />
      ) : inCart ? (
        <Check size={15} color="#065F46" />
      ) : (
        <ShoppingBag size={15} color="#ffffff" />
      )}
    </button>
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
  orgId,
  orgSlug,
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

        {/* Price + Cart + CTA row */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <span className="font-bold text-gray-900 text-base flex-1">
            {price > 0 ? `$${price.toLocaleString()}` : 'Free'}
          </span>
          {!isWaitlistOnly && orgId != null && orgSlug ? (
            <>
              <CartButton
                workshopId={id}
                orgId={orgId}
                orgSlug={orgSlug}
                publicSlug={publicSlug}
              />
              <Link
                href={`/workshops/${publicSlug}`}
                className="text-[#0FA3B1] font-semibold text-sm flex items-center gap-1 hover:gap-2 transition-all"
                onClick={(e) => e.stopPropagation()}
              >
                View <ArrowRight size={13} />
              </Link>
            </>
          ) : isWaitlistOnly ? (
            <span className="text-gray-400 text-sm flex items-center gap-1.5">
              Waitlist Only <Lock size={12} />
            </span>
          ) : (
            <Link
              href={`/workshops/${publicSlug}`}
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

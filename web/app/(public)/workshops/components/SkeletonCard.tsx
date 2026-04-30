export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-border-gray overflow-hidden flex flex-col">
      {/* Image placeholder */}
      <div className="h-44 bg-gray-200 animate-pulse" />

      {/* Content */}
      <div className="p-4 flex flex-col gap-3">
        {/* Category badge */}
        <div className="h-5 w-24 bg-gray-200 animate-pulse rounded-full" />
        {/* Title */}
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 animate-pulse rounded w-full" />
          <div className="h-4 bg-gray-200 animate-pulse rounded w-4/5" />
        </div>
        {/* Description */}
        <div className="space-y-1.5">
          <div className="h-3 bg-gray-200 animate-pulse rounded w-full" />
          <div className="h-3 bg-gray-200 animate-pulse rounded w-3/4" />
        </div>
        {/* Meta row */}
        <div className="flex items-center gap-3 pt-1">
          <div className="h-3 bg-gray-200 animate-pulse rounded w-24" />
          <div className="h-3 bg-gray-200 animate-pulse rounded w-20" />
        </div>
        {/* Tags row */}
        <div className="flex gap-2 pt-1">
          <div className="h-5 w-16 bg-gray-200 animate-pulse rounded-full" />
          <div className="h-5 w-20 bg-gray-200 animate-pulse rounded-full" />
        </div>
        {/* Bottom row */}
        <div className="flex items-center justify-between pt-2 border-t border-border-gray">
          <div className="h-3 bg-gray-200 animate-pulse rounded w-28" />
          <div className="h-7 w-24 bg-gray-200 animate-pulse rounded-lg" />
        </div>
      </div>
    </div>
  );
}

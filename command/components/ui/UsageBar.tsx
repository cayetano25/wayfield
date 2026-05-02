interface UsageBarProps {
  value: number;
  limit: number | null;
  label?: string;
}

export function UsageBar({ value, limit, label }: UsageBarProps) {
  const isUnlimited = limit === null;
  const pct = isUnlimited ? 30 : Math.min((value / limit) * 100, 100);

  let barColor = 'bg-[#0FA3B1]';
  if (!isUnlimited) {
    const ratio = value / limit;
    if (ratio >= 1) barColor = 'bg-red-500';
    else if (ratio >= 0.8) barColor = 'bg-amber-400';
  }

  const displayLabel = label ?? (isUnlimited ? 'Unlimited' : `${value.toLocaleString()} of ${limit!.toLocaleString()}`);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-sm text-gray-600"
          style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)' }}
        >
          {displayLabel}
        </span>
        {isUnlimited && (
          <span className="text-xs text-gray-400">No limit</span>
        )}
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
          data-testid="usage-bar-fill"
          data-ratio={isUnlimited ? null : value / limit!}
        />
      </div>
    </div>
  );
}

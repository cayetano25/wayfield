import { Hotel, MapPin, Navigation } from 'lucide-react';
import { FormattedAddress } from '@/components/ui/FormattedAddress';
import type { SessionLocationResponse } from '@/lib/types/session-location';

interface SessionLocationDisplayProps {
  location: SessionLocationResponse | null;
  compact?: boolean;
}

const TYPE_ICONS = {
  hotel:       Hotel,
  address:     MapPin,
  coordinates: Navigation,
} as const;

const TYPE_LABELS = {
  hotel:       'Workshop Hotel',
  address:     'Address',
  coordinates: 'Field Location',
} as const;

export function SessionLocationDisplay({
  location,
  compact = false,
}: SessionLocationDisplayProps) {
  if (!location || !location.type) {
    return <span className="text-sm text-[#9CA3AF]">No location set</span>;
  }

  const { type, notes, name, latitude, longitude, address, maps_url } = location;

  /* -- Compact (single-line) mode -- */
  if (compact) {
    let text = '';

    if (type === 'hotel') {
      text = `🏨 ${name ?? 'Workshop Hotel'}`;
      if (notes) text += ` (${notes})`;
    } else if (type === 'address') {
      const parts = [address?.locality, address?.administrative_area].filter(Boolean);
      text = `📍 ${parts.length > 0 ? parts.join(', ') : (name ?? 'Address')}`;
    } else if (type === 'coordinates') {
      const latStr = latitude != null ? latitude.toFixed(4) : '?';
      const lngStr = longitude != null ? longitude.toFixed(4) : '?';
      text = `🗺 ${latStr}, ${lngStr}`;
    }

    if (maps_url) {
      return (
        <a
          href={maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#0FA3B1] hover:underline"
        >
          {text}
        </a>
      );
    }

    return <span className="text-sm text-[#2E2E2E]">{text}</span>;
  }

  /* -- Full card mode -- */
  const TypeIcon = TYPE_ICONS[type];
  const typeLabel = TYPE_LABELS[type];

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <TypeIcon className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
        <span className="text-[13px] font-semibold text-[#2E2E2E]">{typeLabel}</span>
      </div>

      {/* Hotel */}
      {type === 'hotel' && (
        <div className="space-y-1">
          {name && <p className="text-sm font-medium text-[#2E2E2E]">{name}</p>}
          {address && (
            <FormattedAddress address={address} compact={true} showCountry={false} className="text-[#6B7280]" />
          )}
        </div>
      )}

      {/* Address */}
      {type === 'address' && address && (
        <FormattedAddress address={address} compact={false} showCountry={true} />
      )}

      {/* Coordinates */}
      {type === 'coordinates' && (
        <div className="space-y-1">
          {name && <p className="text-sm font-medium text-[#2E2E2E]">{name}</p>}
          {latitude != null && longitude != null && (
            <p className="text-[13px] text-[#6B7280] font-mono">
              {latitude}, {longitude}
            </p>
          )}
        </div>
      )}

      {/* Notes (all types) */}
      {notes && (
        <p className="text-xs italic text-[#9CA3AF]">📌 {notes}</p>
      )}

      {/* Maps link */}
      {maps_url && (
        <a
          href={maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-[#0FA3B1] hover:underline"
        >
          Open in Google Maps ↗
        </a>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MapPin } from 'lucide-react';
import type { ParticipantLogistics } from '@/lib/types/participant';

interface WorkshopInfoCardProps {
  logistics: ParticipantLogistics | null;
  workshopId: number;
  publicSlug?: string | null;
  publicPageEnabled?: boolean;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono mb-1">
      {children}
    </p>
  );
}

function stripNonNumeric(value: string): string {
  return value.replace(/\D/g, '');
}

export function WorkshopInfoCard({ logistics, workshopId, publicSlug, publicPageEnabled }: WorkshopInfoCardProps) {
  const mapsUrl =
    logistics?.location_lat != null && logistics?.location_lng != null
      ? `https://maps.apple.com/?ll=${logistics.location_lat},${logistics.location_lng}&q=${encodeURIComponent(logistics.location_name ?? 'Workshop Location')}`
      : logistics?.hotel_address_display
        ? `https://maps.apple.com/?q=${encodeURIComponent(logistics.hotel_address_display)}`
        : null;

  const workshopDetailsHref =
    publicSlug && publicPageEnabled ? `/workshops/${publicSlug}` : `/workshops/${workshopId}`;

  const hasLogisticsContent =
    logistics &&
    (logistics.location_name ||
      logistics.venue_address_display ||
      logistics.hotel_name ||
      logistics.hotel_address_display ||
      logistics.hotel_phone ||
      logistics.hotel_notes ||
      logistics.meeting_room_details ||
      logistics.parking_details ||
      logistics.meetup_instructions);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Map / image area */}
      <div className="relative h-44 overflow-hidden">
        {logistics?.workshop_image_url ? (
          <Image
            src={logistics.workshop_image_url}
            alt="Workshop"
            fill
            className="object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: 'linear-gradient(135deg, #0FA3B1 0%, #0074A6 100%)' }}
          />
        )}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg font-sans font-semibold text-white"
            style={{
              fontSize: 12,
              padding: '6px 10px',
              backgroundColor: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <MapPin size={12} />
            Open in Maps
          </a>
        )}
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Venue */}
        {(logistics?.location_name || logistics?.venue_address_display) && (
          <div>
            <SectionLabel>Venue</SectionLabel>
            {logistics.location_name && (
              <p className="text-sm font-medium text-gray-900">{logistics.location_name}</p>
            )}
            {logistics.venue_address_display && (
              mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#0FA3B1] hover:underline mt-0.5 block leading-relaxed"
                >
                  {logistics.venue_address_display}
                </a>
              ) : (
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  {logistics.venue_address_display}
                </p>
              )
            )}
          </div>
        )}

        {/* Hotel */}
        {(logistics?.hotel_name || logistics?.hotel_address_display || logistics?.hotel_phone) && (
          <div>
            <SectionLabel>Hotel</SectionLabel>
            {logistics.hotel_name && (
              <p className="text-sm font-medium text-gray-900">{logistics.hotel_name}</p>
            )}
            {logistics.hotel_address_display && (
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                {logistics.hotel_address_display}
              </p>
            )}
            {logistics.hotel_phone && (
              <a
                href={`tel:${stripNonNumeric(logistics.hotel_phone)}`}
                className="text-xs text-[#0FA3B1] hover:underline mt-0.5 block"
              >
                {logistics.hotel_phone}
              </a>
            )}
            {logistics.hotel_notes && (
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {logistics.hotel_notes}
              </p>
            )}
          </div>
        )}

        {/* Meeting Room */}
        {logistics?.meeting_room_details && (
          <div>
            <SectionLabel>Meeting Room</SectionLabel>
            <p className="text-xs text-gray-500 leading-relaxed">
              {logistics.meeting_room_details}
            </p>
          </div>
        )}

        {/* Parking */}
        {logistics?.parking_details && (
          <div>
            <SectionLabel>Parking</SectionLabel>
            <p className="text-xs text-gray-500 leading-relaxed">
              {logistics.parking_details}
            </p>
          </div>
        )}

        {/* Meetup Instructions */}
        {logistics?.meetup_instructions && (
          <div>
            <SectionLabel>Meetup Instructions</SectionLabel>
            <p className="text-xs text-gray-500 leading-relaxed">
              {logistics.meetup_instructions}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!hasLogisticsContent && (
          <p className="text-sm text-gray-400">Logistics details coming soon.</p>
        )}

        {/* Workshop Details link */}
        <Link
          href={workshopDetailsHref}
          className="block text-sm font-semibold text-[#0FA3B1] hover:underline pt-1 border-t border-gray-100"
        >
          Workshop Details →
        </Link>
      </div>
    </div>
  );
}

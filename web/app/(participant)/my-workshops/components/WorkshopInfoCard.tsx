'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { ParticipantLogistics } from '@/lib/types/participant';

interface WorkshopInfoCardProps {
  logistics: ParticipantLogistics | null;
  workshopId: number;
  publicSlug?: string | null;
  publicPageEnabled?: boolean;
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

  return (
    <div
      className="bg-white overflow-hidden flex"
      style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minHeight: 160 }}
    >
      {/* Left: cover image or gradient — 40% */}
      <div
        className="shrink-0 overflow-hidden"
        style={{
          width: '40%',
          minHeight: 160,
          borderRadius: '12px 0 0 12px',
        }}
      >
        {logistics?.workshop_image_url ? (
          <img
            src={logistics.workshop_image_url}
            alt="Workshop"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: 'linear-gradient(135deg, #0FA3B1 0%, #0074A6 100%)' }}
          />
        )}
      </div>

      {/* Right: content — 60% */}
      <div className="flex-1 flex flex-col" style={{ padding: '16px 20px' }}>
        <h3
          className="font-heading font-bold mb-3"
          style={{ fontSize: 16, color: '#2E2E2E' }}
        >
          Workshop Info
        </h3>

        {/* Venue address block */}
        {(logistics?.location_name || logistics?.venue_address_display) && (
          <div className="mb-3">
            <p
              className="font-sans font-semibold uppercase"
              style={{ fontSize: 10, letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 2 }}
            >
              Venue
            </p>
            {logistics.location_name && (
              <p className="font-sans font-semibold" style={{ fontSize: 14, color: '#2E2E2E' }}>
                {logistics.location_name}
              </p>
            )}
            {logistics.venue_address_display && (
              mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans mt-0.5 hover:underline"
                  style={{ fontSize: 13, color: '#0FA3B1', lineHeight: 1.6, display: 'block' }}
                >
                  {logistics.venue_address_display}
                </a>
              ) : (
                <p className="font-sans mt-0.5" style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
                  {logistics.venue_address_display}
                </p>
              )
            )}
          </div>
        )}

        {/* Hotel block */}
        {(logistics?.hotel_name || logistics?.hotel_address_display || logistics?.hotel_phone) && (
          <div className="mb-3">
            <p
              className="font-sans font-semibold uppercase"
              style={{ fontSize: 10, letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 2 }}
            >
              Hotel
            </p>
            {logistics.hotel_name && (
              <p
                className="font-sans font-semibold"
                style={{ fontSize: 14, color: '#2E2E2E' }}
              >
                {logistics.hotel_name}
              </p>
            )}

            {logistics.hotel_address_display && (
              <p
                className="font-sans mt-0.5"
                style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}
              >
                {logistics.hotel_address_display}
              </p>
            )}

            {logistics.hotel_phone && (
              <a
                href={`tel:${stripNonNumeric(logistics.hotel_phone)}`}
                className="font-sans underline"
                style={{ fontSize: 13, color: '#0FA3B1' }}
              >
                {logistics.hotel_phone}
              </a>
            )}

            {logistics.hotel_notes && (
              <p
                className="font-sans mt-1"
                style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5 }}
              >
                {logistics.hotel_notes}
              </p>
            )}
          </div>
        )}

        {/* Meeting room, Parking + Meetup details */}
        {(logistics?.meeting_room_details || logistics?.parking_details || logistics?.meetup_instructions) && (
          <div className="flex flex-col gap-2 mb-3">
            {logistics.meeting_room_details && (
              <div>
                <p
                  className="font-sans font-semibold uppercase"
                  style={{ fontSize: 10, letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 2 }}
                >
                  Meeting Room
                </p>
                <p className="font-sans" style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                  {logistics.meeting_room_details}
                </p>
              </div>
            )}
            {logistics.parking_details && (
              <div>
                <p
                  className="font-sans font-semibold uppercase"
                  style={{ fontSize: 10, letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 2 }}
                >
                  Parking
                </p>
                <p className="font-sans" style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                  {logistics.parking_details}
                </p>
              </div>
            )}
            {logistics.meetup_instructions && (
              <div>
                <p
                  className="font-sans font-semibold uppercase"
                  style={{ fontSize: 10, letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 2 }}
                >
                  Meetup Instructions
                </p>
                <p className="font-sans" style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                  {logistics.meetup_instructions}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Map link + Workshop Details */}
        <div className="flex flex-col gap-1 mt-auto">
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-sans font-semibold hover:underline"
              style={{ fontSize: 13, color: '#0FA3B1' }}
            >
              <MapPin size={13} />
              Open in Maps
            </a>
          )}

          <Link
            href={workshopDetailsHref}
            className="font-sans font-semibold hover:underline"
            style={{ fontSize: 13, color: '#0FA3B1' }}
          >
            Workshop Details →
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import type { ParticipantLogistics } from '@/lib/types/participant';

interface WorkshopInfoCardProps {
  logistics: ParticipantLogistics;
  workshopId: number;
}

export function WorkshopInfoCard({ logistics, workshopId }: WorkshopInfoCardProps) {
  const hasContent =
    logistics.hotel_name ||
    logistics.hotel_address_display ||
    logistics.maps_url;

  if (!hasContent) return null;

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
        {logistics.workshop_image_url ? (
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
          className="font-heading font-bold mb-2"
          style={{ fontSize: 16, color: '#2E2E2E' }}
        >
          Workshop Info
        </h3>

        {logistics.hotel_name && (
          <p
            className="font-sans font-semibold mb-1"
            style={{ fontSize: 14, color: '#2E2E2E' }}
          >
            {logistics.hotel_name}
          </p>
        )}

        {logistics.hotel_address_display && (
          <p
            className="font-sans leading-relaxed mb-3"
            style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}
          >
            {logistics.hotel_address_display}
          </p>
        )}

        <div className="flex flex-col gap-1 mt-auto">
          {logistics.maps_url && (
            <a
              href={logistics.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans font-semibold hover:underline"
              style={{ fontSize: 13, color: '#0FA3B1' }}
            >
              View Map →
            </a>
          )}
          <Link
            href={`/workshops/${workshopId}`}
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

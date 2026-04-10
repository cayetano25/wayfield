import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { DiscoverWorkshop } from '@/lib/api/public';

/* ─── Helpers ─────────────────────────────────────────────────────────── */

const GRADIENTS = [
  'linear-gradient(135deg, #E67E22 0%, #C0392B 100%)', // warm desert
  'linear-gradient(135deg, #0FA3B1 0%, #0891B2 100%)', // ocean teal
  'linear-gradient(135deg, #27AE60 0%, #1E8449 100%)', // forest green
  'linear-gradient(135deg, #2C3E50 0%, #1A252F 100%)', // night sky
];

function titleGradient(title: string): string {
  return GRADIENTS[title.length % 4];
}

function formatDateRange(start: string, end: string): string {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const startDt = new Date(sy, sm - 1, sd);
  const endDt = new Date(ey, em - 1, ed);
  if (start === end) {
    return startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (sm === em && sy === ey) {
    return `${startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${ed}, ${sy}`;
  }
  return `${startDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/* ─── Availability badge ──────────────────────────────────────────────── */

function AvailabilityBadge({ spots }: { spots?: number | null }) {
  if (spots === undefined || spots === null) return null;

  if (spots === 0) {
    return (
      <span
        className="font-sans font-semibold"
        style={{
          fontSize: 11,
          padding: '4px 10px',
          borderRadius: 6,
          backgroundColor: '#FEE2E2',
          color: '#991B1B',
        }}
      >
        Fully booked
      </span>
    );
  }

  const bg = spots > 20 ? '#D1FAE5' : 'white';
  const color = spots > 20 ? '#065F46' : '#2E2E2E';

  return (
    <span
      className="font-sans font-semibold"
      style={{
        fontSize: 11,
        padding: '4px 10px',
        borderRadius: 6,
        backgroundColor: bg,
        color,
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}
    >
      {spots > 20 ? `${spots} spots` : `${spots} spots left`}
    </span>
  );
}

/* ─── Leader avatar ───────────────────────────────────────────────────── */

function LeaderAvatar({ firstName, lastName, imageUrl }: {
  firstName: string;
  lastName: string;
  imageUrl?: string | null;
}) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  if (imageUrl) {
    return <img src={imageUrl} alt={`${firstName} ${lastName}`} className="w-7 h-7 rounded-full object-cover shrink-0" />;
  }
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0"
      style={{ fontSize: 10, fontWeight: 600, background: 'linear-gradient(135deg, #0FA3B1 0%, #0074A6 100%)' }}
    >
      {initials}
    </div>
  );
}

/* ─── WorkshopCard ────────────────────────────────────────────────────── */

interface WorkshopCardProps {
  workshop: DiscoverWorkshop;
}

export function WorkshopCard({ workshop }: WorkshopCardProps) {
  const location = [
    workshop.default_location?.city,
    workshop.default_location?.state_or_region,
  ].filter(Boolean).join(', ');

  const leader = workshop.first_leader;
  const leaderName = leader
    ? `${leader.first_name} ${leader.last_name[0] ?? ''}.`
    : null;

  return (
    <div
      className="bg-white overflow-hidden flex flex-col"
      style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      {/* Image section */}
      <div className="relative overflow-hidden" style={{ height: 200 }}>
        {workshop.hero_image_url ? (
          <img
            src={workshop.hero_image_url}
            alt={workshop.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: titleGradient(workshop.title) }}
          />
        )}

        {/* Availability badge — top right */}
        <div className="absolute top-3 right-3">
          <AvailabilityBadge spots={workshop.spots_remaining} />
        </div>
      </div>

      {/* Content section */}
      <div className="flex flex-col flex-1" style={{ padding: '16px 20px' }}>
        {/* Title */}
        <h3
          className="font-heading font-bold leading-snug"
          style={{ fontSize: 18, color: '#2E2E2E', lineHeight: 1.3 }}
        >
          {workshop.title}
        </h3>

        {/* Location */}
        {location && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <MapPin className="shrink-0" style={{ width: 12, height: 12, color: '#9CA3AF' }} />
            <span className="font-sans" style={{ fontSize: 12, color: '#6B7280' }}>
              {location}
            </span>
          </div>
        )}

        {/* Leader row */}
        <div className="flex items-center gap-2 mt-3">
          {leader && leaderName && (
            <>
              <LeaderAvatar
                firstName={leader.first_name}
                lastName={leader.last_name}
                imageUrl={leader.profile_image_url}
              />
              <span className="font-sans flex-1 min-w-0" style={{ fontSize: 13, color: '#4B5563' }}>
                {leaderName}
              </span>
            </>
          )}
          {!leader && <div className="flex-1" />}

          {/* Date pushed right */}
          <span className="font-sans shrink-0" style={{ fontSize: 12, color: '#9CA3AF' }}>
            {formatDateRange(workshop.start_date, workshop.end_date)}
          </span>
        </div>

        {/* View link */}
        <Link
          href={`/w/${workshop.public_slug}`}
          className="font-sans font-semibold mt-3 hover:underline"
          style={{ fontSize: 13, color: '#0FA3B1' }}
        >
          View Workshop →
        </Link>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { MapPin, Monitor, Layers, Users, Calendar } from 'lucide-react';
import type { DiscoverWorkshop, DiscoverWorkshopTag } from '@/lib/api/public';

/* --- Helpers --------------------------------------------------------------- */

function formatDateRange(start: string, end: string): string {
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

function getTagByGroup(tags: DiscoverWorkshopTag[] | undefined, groupKey: string): DiscoverWorkshopTag | undefined {
  return tags?.find((t) => t.group_key === groupKey);
}

const GRADIENTS = [
  'linear-gradient(135deg, #0FA3B1 0%, #0891B2 100%)',
  'linear-gradient(135deg, #E67E22 0%, #C0392B 100%)',
  'linear-gradient(135deg, #27AE60 0%, #1E8449 100%)',
  'linear-gradient(135deg, #2C3E50 0%, #1A252F 100%)',
];

function titleGradient(title: string): string {
  return GRADIENTS[title.length % 4];
}

/* --- Format indicator ------------------------------------------------------ */

function FormatIndicator({ format }: { format: string | undefined }) {
  if (!format) return null;
  const lower = format.toLowerCase();
  if (lower.includes('virtual')) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-medium-gray">
        <Monitor className="w-3 h-3" />
        Virtual
      </span>
    );
  }
  if (lower.includes('hybrid')) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-medium-gray">
        <Layers className="w-3 h-3" />
        Hybrid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-medium-gray">
      <MapPin className="w-3 h-3" />
      In-Person
    </span>
  );
}

/* --- WorkshopCard ---------------------------------------------------------- */

interface WorkshopCardProps {
  workshop: DiscoverWorkshop;
}

export function WorkshopCard({ workshop }: WorkshopCardProps) {
  const formatTag = getTagByGroup(workshop.tags, 'format');
  const skillTag = getTagByGroup(workshop.tags, 'skill_level');
  const formatValue = formatTag?.label ?? formatTag?.value;

  const loc = workshop.default_location ?? workshop.location;
  const locationParts = [loc?.city, loc?.state_or_region].filter(Boolean);
  let locationText: string;
  if (locationParts.length > 0) {
    locationText = locationParts.join(', ');
  } else if (formatValue?.toLowerCase().includes('virtual')) {
    locationText = 'Online';
  } else {
    locationText = 'Location TBA';
  }

  const categoryName = workshop.taxonomy?.category?.name ?? workshop.category;
  const subcategoryName = workshop.taxonomy?.subcategory?.name;

  return (
    <Link
      href={workshop.public_slug ? `/workshops/${workshop.public_slug}` : '#'}
      className="group bg-white rounded-xl border border-border-gray overflow-hidden flex flex-col
                 transition-shadow duration-200 hover:shadow-[0_8px_24px_rgba(46,46,46,0.12)]
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Image */}
      <div className="relative h-44 overflow-hidden shrink-0">
        {workshop.hero_image_url ? (
          <img
            src={workshop.hero_image_url}
            alt={workshop.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full transition-transform duration-300 group-hover:scale-105"
            style={{ background: titleGradient(workshop.title) }}
          />
        )}

        {/* Category badge — top left */}
        {categoryName && (
          <span className="absolute top-3 left-3 bg-primary text-white text-[11px] font-semibold font-sans
                           px-2.5 py-1 rounded-full leading-none">
            {categoryName}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {/* Subcategory */}
        {subcategoryName && (
          <p className="font-sans text-[11px] text-medium-gray -mb-1">{subcategoryName}</p>
        )}

        {/* Title */}
        <h3 className="font-heading font-semibold text-dark text-[15px] leading-snug
                       line-clamp-2">
          {workshop.title}
        </h3>

        {/* Description */}
        <p className="font-sans text-xs text-medium-gray leading-relaxed line-clamp-2">
          {workshop.description?.replace(/<[^>]*>/g, '') ?? ''}
        </p>

        {/* Date + Location row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
          <span className="inline-flex items-center gap-1 text-xs text-medium-gray">
            <Calendar className="w-3 h-3 shrink-0" />
            {formatDateRange(workshop.start_date, workshop.end_date)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-medium-gray">
            <MapPin className="w-3 h-3 shrink-0" />
            {locationText}
          </span>
        </div>

        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {skillTag && (
            <span className="inline-flex items-center text-[11px] font-semibold font-sans
                             px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: '#7EA8BE' }}>
              {skillTag.label ?? skillTag.value}
            </span>
          )}
          <FormatIndicator format={formatValue} />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom row */}
        <div className="flex items-center justify-between pt-3 border-t border-border-gray mt-1">
          <div className="flex flex-col gap-0.5 min-w-0">
            {workshop.organization?.name && (
              <p className="font-sans text-[11px] text-light-gray truncate">
                {workshop.organization.name}
              </p>
            )}
            {workshop.leader_count > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-light-gray">
                <Users className="w-3 h-3" />
                {workshop.leader_count} leader{workshop.leader_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <span className="font-sans font-semibold text-xs text-primary shrink-0 ml-2
                           group-hover:underline">
            View Workshop →
          </span>
        </div>
      </div>
    </Link>
  );
}

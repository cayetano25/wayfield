import React from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Calendar } from 'lucide-react';
import { getPublicWorkshop, getPublicCategory, getSitemapWorkshops, type PublicLeader } from '@/lib/api/public';
import { ShareWorkshopButton } from '@/components/workshops/ShareWorkshopButton';
import { RichTextDisplay } from '@/components/ui/RichTextDisplay';
import { ScheduleItem } from '@/components/workshops/public/ScheduleItem';
import { RegistrationCard } from '@/components/workshops/public/RegistrationCard';
import { PricingDetailsCard } from '@/components/workshops/public/PricingDetailsCard';
import { buildCategoryMetadata } from '@/lib/seo/metadata';
import { buildEventJsonLd, buildBreadcrumbJsonLd, buildOrganizationJsonLd } from '@/lib/seo/jsonld';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';

export const revalidate = 600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const workshops = await getSitemapWorkshops();
    // The backend returns the slug as `public_slug`; `slug` is the sitemap alias.
    // Filter out any undefined entries — dynamicParams=true handles them on-demand.
    return workshops
      .map((w) => ({ id: w.public_slug }))
      .filter((p): p is { id: string } => typeof p.id === 'string');
  } catch {
    // If backend is unavailable at build time, fall back to empty.
    // dynamicParams = true means pages still render on first request.
    return [];
  }
}

// Allowed public leader fields — enforced here as a second layer after the API
const SAFE_LEADER_FIELDS: (keyof PublicLeader)[] = [
  'id', 'first_name', 'last_name', 'display_name',
  'bio', 'profile_image_url', 'website_url', 'city', 'state_or_region',
  'country', 'country_name',
];

function formatLeaderLocation(leader: PublicLeader): string | null {
  if (!leader.city) return null;

  // US / Canada: "Portland, OR" or "Vancouver, BC"
  if (leader.country === 'US' || leader.country === 'USA' || leader.country === 'CA' || leader.country === 'CAN') {
    return leader.state_or_region
      ? `${leader.city}, ${leader.state_or_region}`
      : leader.city;
  }

  // Countries with a name available: "Reykjavik, Iceland" (state optional)
  if (leader.country_name) {
    return leader.state_or_region
      ? `${leader.city}, ${leader.state_or_region}, ${leader.country_name}`
      : `${leader.city}, ${leader.country_name}`;
  }

  // Fallback: city + state if available, or just city
  return leader.state_or_region
    ? `${leader.city}, ${leader.state_or_region}`
    : leader.city;
}

function sanitizeLeader(leader: PublicLeader): PublicLeader {
  const safe: Partial<PublicLeader> = {};
  for (const key of SAFE_LEADER_FIELDS) {
    (safe as Record<string, unknown>)[key] = leader[key];
  }
  return safe as PublicLeader;
}

function formatDateRange(start: string, end: string, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: timezone,
  };
  const s = new Date(`${start}T00:00:00`).toLocaleDateString('en-US', opts);
  const e = new Date(`${end}T00:00:00`).toLocaleDateString('en-US', opts);
  return s === e ? s : `${s} – ${e}`;
}

// --- generateMetadata --------------------------------------------------------

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const workshop = await getPublicWorkshop(id);

  if (workshop) {
    const resolvedTitle = workshop.social_share_title || workshop.title;
    const resolvedDescription = (
      workshop.social_share_description ||
      workshop.public_summary ||
      (workshop.description ? workshop.description.replace(/<[^>]*>/g, '') : undefined)
    )?.slice(0, 160) || undefined;

    const canonical = workshop.canonical_url;
    const socialImage = workshop.social_share_image_url ?? null;

    return {
      title: `${resolvedTitle} | Wayfield`,
      description: resolvedDescription,
      alternates: { canonical },
      robots: workshop.public_page_is_indexable
        ? { index: true, follow: true }
        : { index: false, follow: false },
      openGraph: {
        type: 'website',
        url: canonical,
        title: resolvedTitle,
        description: resolvedDescription,
        siteName: 'Wayfield',
        locale: 'en_US',
        ...(socialImage ? { images: [{ url: socialImage, width: 1200, height: 630 }] } : {}),
      },
      twitter: {
        card: 'summary_large_image',
        title: resolvedTitle,
        description: resolvedDescription,
        site: '@wayfieldapp',
        ...(socialImage ? { images: [socialImage] } : {}),
      },
    };
  }

  // Fallback: try category slug
  const categoryData = await getPublicCategory(id);
  if (categoryData) {
    return buildCategoryMetadata(categoryData.category);
  }

  return { title: 'Not Found' };
}

// --- Page --------------------------------------------------------------------

export default async function PublicWorkshopPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workshop = await getPublicWorkshop(id);

  // Category fallback — try slug as a category before calling notFound()
  if (!workshop) {
    const categoryData = await getPublicCategory(id);
    if (categoryData) {
      return (
        <>
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Workshops', href: '/workshops' },
              {
                label: categoryData.category.name,
                href: `/workshops/${categoryData.category.slug}`,
              },
            ]}
          />
          <JsonLd data={buildOrganizationJsonLd()} />
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h1 className="font-heading text-3xl font-bold text-dark mb-4" style={{ fontFamily: 'Sora, sans-serif' }}>
              {categoryData.category.name} Workshops
            </h1>
            {categoryData.category.description && (
              <p className="text-medium-gray leading-relaxed">{categoryData.category.description}</p>
            )}
          </div>
        </>
      );
    }
    notFound();
  }

  const standardSessions = workshop.sessions.filter(s => !s.is_addon);
  const addonSessions = workshop.sessions.filter(s => s.is_addon);

  // Compute ordered unique dates for DAY 01 / DAY 02 labels
  const sessionDates = [...new Set(
    workshop.sessions.map(s => new Date(s.start_at).toDateString())
  )].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const locationLine = [
    workshop.default_location?.city,
    workshop.default_location?.state_or_region,
  ].filter(Boolean).join(', ');

  const dateRange = formatDateRange(workshop.start_date, workshop.end_date, workshop.timezone);
  const slug = workshop.public_slug ?? id;

  return (
    <>
      <JsonLd data={buildEventJsonLd(workshop)} />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: 'Home', url: 'https://wayfield.app/' },
          { name: 'Workshops', url: 'https://wayfield.app/workshops' },
          { name: workshop.title, url: `https://wayfield.app/workshops/${slug}` },
        ])}
      />
      {/* Hero */}
      <section className="relative w-full overflow-hidden" style={{ minHeight: '36vh' }}>
        {/* Background image or teal gradient fallback */}
        {workshop.hero_image_url ? (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${workshop.hero_image_url})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#0FA3B1] to-[#1a3a4a]" />
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 to-black/75" />

        {/* Content row */}
        <div
          className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 flex items-end pb-8 pt-12"
          style={{ minHeight: '36vh' }}
        >
          {/* Left: title and meta — ~60% width */}
          <div className="flex-1 max-w-[60%] pr-8">

            {/* Type badge */}
            <div className="inline-flex items-center px-3 py-1 rounded-full
              border border-[#0FA3B1] text-[#0FA3B1] text-xs font-bold
              uppercase tracking-wider font-mono mb-4">
              {workshop.workshop_type === 'session_based' ? 'Session-Based' : 'Event-Based'}
            </div>

            {/* Title */}
            <h1 className="font-heading text-4xl lg:text-5xl font-bold text-white leading-tight mb-3">
              {workshop.hero_title ?? workshop.title}
            </h1>

            {/* Subtitle */}
            {workshop.hero_subtitle && (
              <p className="text-lg text-white/80 max-w-2xl mb-4">{workshop.hero_subtitle}</p>
            )}

            {/* Date · Location row */}
            <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm mb-6">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                {dateRange}
              </span>
              {locationLine && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} />
                  {locationLine}
                </span>
              )}
            </div>

            {/* Action buttons — unchanged handlers, restyled to outlined white */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 border border-white/60 text-white font-bold px-6 py-3 rounded-lg hover:bg-white/10 active:scale-[0.98] transition-all text-sm"
              >
                <span className="material-symbols-outlined text-base">key</span>
                Join with a code
              </Link>
              <ShareWorkshopButton
                workshopTitle={workshop.title}
                publicUrl={workshop.canonical_url}
                variant="participant"
                showLabel
                className="inline-flex items-center gap-2 border border-white/60 text-white hover:bg-white/10 active:scale-[0.98] transition-all px-5 py-3 rounded-lg text-sm font-bold"
              />
            </div>
          </div>

          {/* Right: registration card — desktop only */}
          <div className="hidden lg:block w-72 flex-shrink-0">
            <RegistrationCard workshop={workshop} />
          </div>
        </div>
      </section>

      {/* Breadcrumbs — below hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Workshops', href: '/workshops' },
              { label: workshop.title, href: `/workshops/${slug}` },
            ]}
          />
        </div>
      </div>

      {/* Mobile registration card — visible below hero on small screens */}
      <div className="lg:hidden px-4 -mt-4 relative z-10">
        <RegistrationCard workshop={workshop} />
      </div>

      {/* Two-column content area */}
      <div className="bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12">
          <div className="flex gap-10 items-start">

            {/* LEFT COLUMN — description, schedule, leaders */}
            <div className="flex-1 min-w-0">

              {/* Description */}
              {(workshop.description || workshop.body_content) && (
                <div>
                  <h2 className="font-heading text-2xl font-bold text-gray-900 mb-4">
                    About This Workshop
                  </h2>
                  <RichTextDisplay
                    html={workshop.description ?? ''}
                    className="text-medium-gray mb-6"
                  />
                  {workshop.body_content && (
                    <div
                      className="prose prose-sm max-w-none text-medium-gray leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: workshop.body_content }}
                    />
                  )}
                </div>
              )}

              {/* Schedule */}
              {workshop.sessions.length > 0 && (
                <div>
                  {standardSessions.length > 0 && (
                    <>
                      <h2 className="font-heading text-2xl font-bold text-gray-900 mb-4 mt-10">
                        Schedule
                      </h2>
                      <div className="divide-y divide-gray-100">
                        {standardSessions.map((session) => {
                          const dayIdx = sessionDates.indexOf(
                            new Date(session.start_at).toDateString()
                          )
                          return (
                            <ScheduleItem
                              key={session.id}
                              session={session}
                              dayLabel={`DAY ${String(dayIdx + 1).padStart(2, '0')}`}
                            />
                          )
                        })}
                      </div>
                    </>
                  )}
                  {addonSessions.length > 0 && (
                    <>
                      <h2 className="font-heading text-2xl font-bold text-gray-900 mb-4 mt-10">
                        Add-On Sessions
                      </h2>
                      <div className="divide-y divide-gray-100">
                        {addonSessions.map((session) => {
                          const dayIdx = sessionDates.indexOf(
                            new Date(session.start_at).toDateString()
                          )
                          return (
                            <ScheduleItem
                              key={session.id}
                              session={session}
                              dayLabel={`DAY ${String(dayIdx + 1).padStart(2, '0')}`}
                            />
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Leaders */}
              {workshop.leaders.length > 0 && (
                <div>
                  <h2 className="font-heading text-2xl font-bold text-gray-900 mb-6 mt-10">
                    Workshop Leaders
                  </h2>
                  <div className="space-y-6">
                    {workshop.leaders.map((raw) => {
                      const leader = sanitizeLeader(raw)
                      const initials = `${leader.first_name?.[0] ?? ''}${leader.last_name?.[0] ?? ''}`.toUpperCase()
                      const location = formatLeaderLocation(leader)
                      return (
                        <div key={leader.id} className="flex items-start gap-4">
                          {leader.profile_image_url ? (
                            <Image
                              src={leader.profile_image_url}
                              alt={`${leader.first_name} ${leader.last_name}, Workshop Leader`}
                              width={40}
                              height={40}
                              className="rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10
                              flex items-center justify-center text-primary
                              font-semibold text-xs flex-shrink-0">
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">
                              {leader.display_name ?? `${leader.first_name} ${leader.last_name}`}
                            </p>
                            {leader.bio && (
                              <p className="text-gray-500 text-sm italic mt-0.5">
                                &ldquo;{leader.bio.substring(0, 100)}{leader.bio.length > 100 ? '…' : ''}&rdquo;
                              </p>
                            )}
                            {location && (
                              <p className="text-gray-400 text-xs mt-1 flex items-center gap-1">
                                <MapPin size={10} />
                                {location}
                              </p>
                            )}
                            {leader.website_url && (
                              <a
                                href={leader.website_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary font-medium
                                  hover:underline truncate block mt-0.5"
                              >
                                {leader.website_url.replace(/^https?:\/\//, '')}
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>{/* end LEFT COLUMN */}

            {/* RIGHT COLUMN — sticky pricing details */}
            <div className="hidden lg:block w-80 flex-shrink-0">
              <div className="sticky top-6">
                <PricingDetailsCard workshop={workshop} />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Hotel & Logistics section */}
      {(workshop.logistics?.hotel_name || workshop.logistics?.meetup_instructions) && (
        <section className="bg-[#0FA3B1] w-full py-12">
          <div className="max-w-6xl mx-auto px-6 lg:px-8">

            <h2 className="font-heading text-2xl font-bold text-white mb-8">
              Hotel &amp; Logistics
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

              {/* Accommodation */}
              {workshop.logistics.hotel_name && (
                <div>
                  <p className="font-heading text-2xl font-bold text-white mb-2">
                    Accommodation
                  </p>
                  <p className="text-white font-bold text-lg mb-2">
                    {workshop.logistics.hotel_name}
                  </p>
                  {workshop.logistics.hotel_notes && (
                    <p className="text-white/80 text-sm leading-relaxed">
                      {workshop.logistics.hotel_notes}
                    </p>
                  )}
                  {workshop.logistics.hotel_phone && (
                    <p className="text-white/60 text-sm mt-2">
                      {workshop.logistics.hotel_phone}
                    </p>
                  )}
                </div>
              )}

              {/* Travel & Parking */}
              {(workshop.logistics.parking_details ||
                workshop.logistics.meetup_instructions ||
                workshop.logistics.meeting_room_details) && (
                <div>
                  <p className="font-heading text-2xl font-bold text-white mb-2">
                    Travel &amp; Parking
                  </p>
                  {workshop.logistics.meetup_instructions && (
                    <div className="mb-4">
                      <p className="text-white font-bold text-sm mb-1">
                        Getting Here
                      </p>
                      <p className="text-white/80 text-sm leading-relaxed">
                        {workshop.logistics.meetup_instructions}
                      </p>
                    </div>
                  )}
                  {workshop.logistics.parking_details && (
                    <div>
                      <p className="text-white font-bold text-sm mb-1">
                        Ground Transportation
                      </p>
                      <p className="text-white/80 text-sm leading-relaxed">
                        {workshop.logistics.parking_details}
                      </p>
                    </div>
                  )}
                  {workshop.logistics.meeting_room_details && (
                    <div className="mt-4">
                      <p className="text-white font-bold text-sm mb-1">
                        Meeting Room
                      </p>
                      <p className="text-white/80 text-sm leading-relaxed">
                        {workshop.logistics.meeting_room_details}
                      </p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </section>
      )}

      {/* TODO: More workshops section — requires related workshops API data */}

      {/* Footer CTA */}
      <section
        className="py-20 text-center text-white"
        style={{ background: 'linear-gradient(135deg, #006972 0%, #0FA3B1 100%)' }}
      >
        <div className="max-w-lg mx-auto px-6">
          <span className="material-symbols-outlined text-5xl mb-4 block opacity-80">smartphone</span>
          <h2 className="font-heading text-2xl font-bold mb-3">Have a join code?</h2>
          <p className="text-white/80 mb-8 leading-relaxed">
            Download the Wayfield app to join this workshop, select sessions, and access everything
            you need — even offline.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="#"
              className="inline-flex items-center gap-2 bg-white text-primary font-bold px-6 py-3 rounded-lg shadow hover:bg-white/90 text-sm"
            >
              <span className="material-symbols-outlined text-base">phone_iphone</span>
              Download on iOS
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2 bg-white/10 border border-white/30 text-white font-bold px-6 py-3 rounded-lg hover:bg-white/20 text-sm"
            >
              <span className="material-symbols-outlined text-base">android</span>
              Get it on Android
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

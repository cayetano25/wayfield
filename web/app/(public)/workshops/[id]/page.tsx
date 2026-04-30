import React from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { getPublicWorkshop, getPublicCategory, getSitemapWorkshops, type PublicLeader } from '@/lib/api/public';
import { ShareWorkshopButton } from '@/components/workshops/ShareWorkshopButton';
import { RichTextDisplay } from '@/components/ui/RichTextDisplay';
import { WorkshopPriceDisplay } from '@/components/workshops/public/WorkshopPriceDisplay';
import { AddToCartButton } from '@/components/workshops/public/AddToCartButton';
import { ScheduleItem } from '@/components/workshops/public/ScheduleItem';
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

function LeaderCard({ leader: raw }: { leader: PublicLeader }) {
  // Sanitize before rendering — double-check no private fields slip through
  const leader = sanitizeLeader(raw);
  const initials = `${leader.first_name?.[0] ?? ''}${leader.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="bg-white rounded-xl border border-border-gray p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center gap-3">
        {leader.profile_image_url ? (
          <Image
            src={leader.profile_image_url}
            alt={`${leader.first_name} ${leader.last_name}, Workshop Leader`}
            width={48}
            height={48}
            className="rounded-full object-cover border border-border-gray"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-heading font-semibold text-dark leading-tight">
            {leader.display_name ?? `${leader.first_name} ${leader.last_name}`}
          </p>
          {formatLeaderLocation(leader) && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin size={10} />
              {formatLeaderLocation(leader)}
            </p>
          )}
        </div>
      </div>
      {leader.bio && (
        <p className="text-sm text-medium-gray leading-relaxed line-clamp-3">{leader.bio}</p>
      )}
      {leader.website_url && (
        <a
          href={leader.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary font-medium hover:underline truncate"
        >
          {leader.website_url.replace(/^https?:\/\//, '')}
        </a>
      )}
    </div>
  );
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

  const locationLine = [
    workshop.default_location?.city,
    workshop.default_location?.state_or_region,
  ].filter(Boolean).join(', ');

  const dateRange = formatDateRange(workshop.start_date, workshop.end_date, workshop.timezone);
  const slug = workshop.public_slug ?? id;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Workshops', href: '/workshops' },
          { label: workshop.title, href: `/workshops/${slug}` },
        ]}
      />
      <JsonLd data={buildEventJsonLd(workshop)} />
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: 'Home', url: 'https://wayfield.app/' },
          { name: 'Workshops', url: 'https://wayfield.app/workshops' },
          { name: workshop.title, url: `https://wayfield.app/workshops/${slug}` },
        ])}
      />
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ minHeight: '420px' }}>
        {workshop.hero_image_url ? (
          <Image
            src={workshop.hero_image_url}
            alt={`${workshop.title} workshop`}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background: workshop.hero_image_url
              ? 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.65) 100%)'
              : 'linear-gradient(135deg, #006972 0%, #0FA3B1 100%)',
          }}
        />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-sm">
              {workshop.workshop_type === 'session_based' ? 'Session-Based' : 'Event-Based'}
            </span>
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-white leading-tight">
            {workshop.hero_title ?? workshop.title}
          </h1>
          {workshop.hero_subtitle && (
            <p className="text-lg text-white/90 max-w-2xl">{workshop.hero_subtitle}</p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">calendar_today</span>
              {dateRange}
            </span>
            {locationLine && (
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">location_on</span>
                {locationLine}
              </span>
            )}
          </div>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-white text-primary font-bold px-6 py-3 rounded-lg shadow-lg hover:bg-white/90 active:scale-[0.98] transition-all text-sm"
            >
              <span className="material-symbols-outlined text-base">key</span>
              Join with a code
            </Link>
            <ShareWorkshopButton
              workshopTitle={workshop.title}
              publicUrl={workshop.canonical_url}
              variant="participant"
              showLabel
              className="inline-flex items-center gap-2 bg-white/10 border border-white/30 text-white hover:bg-white/20 active:scale-[0.98] transition-all px-5 py-3 rounded-lg text-sm font-bold"
            />
          </div>
        </div>
      </div>

      {/* Pricing + Add to Cart */}
      {workshop.organization && (
        <section className="max-w-4xl mx-auto px-6 pt-10 pb-0">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 max-w-2xl">
            {/* Only render the price card when it's a paid workshop */}
            {workshop.pricing && workshop.pricing.current_price_cents > 0 && (
              <div className="flex-1">
                <WorkshopPriceDisplay pricing={workshop.pricing} />
              </div>
            )}
            <div className={workshop.pricing && workshop.pricing.current_price_cents > 0 ? 'sm:flex-shrink-0' : 'w-full sm:max-w-sm'}>
              <AddToCartButton
                workshopId={workshop.id}
                orgId={workshop.organization.id}
                orgSlug={workshop.organization.slug}
                publicSlug={workshop.public_slug}
                pricing={workshop.pricing}
                fullWidth
              />
            </div>
          </div>
        </section>
      )}

      {/* About */}
      {(workshop.description || workshop.body_content) && (
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="font-heading text-2xl font-bold text-dark mb-6">About This Workshop</h2>
          <RichTextDisplay html={workshop.description ?? ''} className="text-medium-gray mb-6" />
          {workshop.body_content && (
            <div
              className="prose prose-sm max-w-none text-medium-gray leading-relaxed"
              dangerouslySetInnerHTML={{ __html: workshop.body_content }}
            />
          )}
        </section>
      )}

      {/* Schedule */}
      {workshop.sessions.length > 0 && (
        <section className="bg-surface py-16">
          <div className="max-w-4xl mx-auto px-6">
            {standardSessions.length > 0 && (
              <>
                <h2 className="font-heading text-2xl font-bold text-dark mb-8">Schedule</h2>
                <div className="space-y-3">
                  {standardSessions.map((session) => (
                    <ScheduleItem key={session.id} session={session} />
                  ))}
                </div>
              </>
            )}
            {addonSessions.length > 0 && (
              <section>
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h2 className="font-heading text-2xl font-bold text-dark mb-8">Add-On Sessions</h2>
                </div>
                <div className="space-y-3">
                  {addonSessions.map((session) => (
                    <ScheduleItem key={session.id} session={session} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </section>
      )}

      {/* Leaders */}
      {workshop.leaders.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="font-heading text-2xl font-bold text-dark mb-8">Workshop Leaders</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {workshop.leaders.map((leader) => (
              <LeaderCard key={leader.id} leader={leader} />
            ))}
          </div>
        </section>
      )}

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

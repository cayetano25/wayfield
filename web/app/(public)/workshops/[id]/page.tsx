import React from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicWorkshop, type PublicLeader, type PublicSession, type PublicLogistics, type PublicLocation } from '@/lib/api/public';
import { ShareWorkshopButton } from '@/components/workshops/ShareWorkshopButton';
import { RichTextDisplay } from '@/components/ui/RichTextDisplay';
import { WorkshopPriceDisplay } from '@/components/workshops/public/WorkshopPriceDisplay';
import { AddToCartButton } from '@/components/workshops/public/AddToCartButton';

// Allowed public leader fields — enforced here as a second layer after the API
const SAFE_LEADER_FIELDS: (keyof PublicLeader)[] = [
  'id', 'first_name', 'last_name', 'display_name',
  'bio', 'profile_image_url', 'website_url', 'city', 'state_or_region',
];

function sanitizeLeader(leader: PublicLeader): PublicLeader {
  const safe: Partial<PublicLeader> = {};
  for (const key of SAFE_LEADER_FIELDS) {
    (safe as Record<string, unknown>)[key] = leader[key];
  }
  return safe as PublicLeader;
}

// Session fields safe to render — meeting credentials are intentionally excluded
function isVirtual(s: PublicSession) {
  return s.delivery_type === 'virtual' || s.delivery_type === 'hybrid';
}

function formatDateRange(start: string, end: string, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: timezone,
  };
  const s = new Date(`${start}T00:00:00`).toLocaleDateString('en-US', opts);
  const e = new Date(`${end}T00:00:00`).toLocaleDateString('en-US', opts);
  return s === e ? s : `${s} – ${e}`;
}

function formatSessionTime(start: string, end: string, timezone: string): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: timezone,
    });
  return `${fmt(start)} – ${new Date(end).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: timezone,
  })}`;
}

function DeliveryBadge({ type }: { type: PublicSession['delivery_type'] }) {
  const map = {
    in_person: { label: 'In Person', cls: 'bg-info/10 text-info' },
    virtual: { label: 'Virtual', cls: 'bg-primary/10 text-primary' },
    hybrid: { label: 'Hybrid', cls: 'bg-secondary/10 text-secondary' },
  };
  const { label, cls } = map[type];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function SessionCard({
  session,
  timezone,
  showAddonBadge = false,
}: {
  session: PublicSession;
  timezone: string;
  showAddonBadge?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-border-gray p-5 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <DeliveryBadge type={session.delivery_type} />
          {showAddonBadge && (
            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-600">
              Add-On
            </span>
          )}
          {session.track_name && (
            <span className="text-xs text-medium-gray font-medium">{session.track_name}</span>
          )}
        </div>
        <p className="font-semibold text-dark">{session.title}</p>
        <p className="text-sm text-medium-gray mt-0.5">
          {formatSessionTime(session.start_at, session.end_at, timezone)}
        </p>
        {(session.location_city || session.location_state) && (
          <p className="text-xs text-medium-gray mt-0.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">location_on</span>
            {[session.location_city, session.location_state].filter(Boolean).join(', ')}
          </p>
        )}
      </div>
      {/* Never show meeting_url — show informational text instead */}
      {isVirtual(session) && (
        <p className="text-xs text-primary font-semibold shrink-0 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">videocam</span>
          Join link provided after registration
        </p>
      )}
    </div>
  );
}

function LeaderCard({ leader: raw }: { leader: PublicLeader }) {
  // Sanitize before rendering — double-check no private fields slip through
  const leader = sanitizeLeader(raw);
  const initials = `${leader.first_name?.[0] ?? ''}${leader.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <div className="bg-white rounded-xl border border-border-gray p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center gap-3">
        {leader.profile_image_url ? (
          <img
            src={leader.profile_image_url}
            alt={`${leader.first_name} ${leader.last_name}`}
            className="w-12 h-12 rounded-full object-cover border border-border-gray"
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
          {(leader.city || leader.state_or_region) && (
            <p className="text-xs text-medium-gray mt-0.5">
              {[leader.city, leader.state_or_region].filter(Boolean).join(', ')}
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

function LogisticsCard({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-border-gray shadow-sm p-6 flex gap-4">
      <span className="material-symbols-outlined text-primary text-xl shrink-0">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

function buildMapsUrl(
  lat?: number | null,
  lng?: number | null,
  name?: string,
  address?: string,
): string | null {
  if (lat != null && lng != null) {
    const q = name ? `&q=${encodeURIComponent(name)}` : '';
    return `https://maps.apple.com/?ll=${lat},${lng}${q}`;
  }
  if (address) {
    return `https://maps.apple.com/?address=${encodeURIComponent(address)}`;
  }
  return null;
}

function MapLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-primary font-medium hover:underline"
    >
      <span className="material-symbols-outlined text-base shrink-0">pin_drop</span>
      {label}
    </a>
  );
}

function LogisticsSection({
  logistics,
  defaultLocation,
}: {
  logistics: PublicLogistics;
  defaultLocation?: PublicLocation;
}) {
  const hasLogistics = Object.values(logistics).some(Boolean);
  const hasDefaultLocation =
    defaultLocation &&
    (defaultLocation.city || defaultLocation.state_or_region || defaultLocation.address_line_1 || defaultLocation.name);

  if (!hasLogistics && !hasDefaultLocation) return null;

  // Map URL for the venue-only card (uses location coordinates when available)
  const venueMapUrl = buildMapsUrl(
    defaultLocation?.latitude,
    defaultLocation?.longitude,
    defaultLocation?.name,
    defaultLocation?.address_line_1,
  );

  // Map URL for the hotel card — prefer structured address, fall back to legacy freeform
  const hotelAddressString =
    logistics.hotel_address_object?.formatted_address ?? logistics.hotel_address ?? null;
  const hotelMapUrl = buildMapsUrl(null, null, logistics.hotel_name, hotelAddressString ?? undefined);

  // Map URL for the parking card (coordinates only — no freeform address fallback)
  const parkingMapUrl =
    defaultLocation?.latitude != null && defaultLocation.longitude != null
      ? buildMapsUrl(defaultLocation.latitude, defaultLocation.longitude, defaultLocation.name)
      : null;

  const cleanPhone = logistics.hotel_phone?.replace(/\D/g, '') ?? '';

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      <h2 className="font-heading text-2xl font-bold text-dark mb-8">Venue &amp; Logistics</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {hasDefaultLocation && !logistics.hotel_name && (
          <LogisticsCard icon="location_on">
            <p className="font-semibold text-dark">{defaultLocation!.name ?? 'Workshop Location'}</p>
            {defaultLocation!.address_line_1 && (
              <p className="text-sm text-medium-gray mt-0.5">{defaultLocation!.address_line_1}</p>
            )}
            {defaultLocation!.address_line_2 && (
              <p className="text-sm text-medium-gray">{defaultLocation!.address_line_2}</p>
            )}
            {(defaultLocation!.city || defaultLocation!.state_or_region) && (
              <p className="text-sm text-medium-gray">
                {[defaultLocation!.city, defaultLocation!.state_or_region, defaultLocation!.postal_code]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            {venueMapUrl && <MapLink url={venueMapUrl} label="Open in Maps" />}
          </LogisticsCard>
        )}

        {logistics.hotel_name && (
          <LogisticsCard icon="hotel">
            <p className="font-heading font-semibold text-dark text-base">{logistics.hotel_name}</p>

            {/* Address: prefer Phase 16 structured object, fall back to legacy freeform string */}
            {logistics.hotel_address_object?.formatted_address ? (
              <p className="mt-1 text-sm text-medium-gray whitespace-pre-line leading-relaxed">
                {logistics.hotel_address_object.formatted_address}
              </p>
            ) : logistics.hotel_address ? (
              <p className="mt-1 text-sm text-medium-gray">{logistics.hotel_address}</p>
            ) : null}

            {/* Phone as tappable tel: link */}
            {logistics.hotel_phone && (
              <a
                href={`tel:${cleanPhone}`}
                className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-primary font-medium hover:underline"
              >
                <span className="material-symbols-outlined text-base shrink-0">call</span>
                {logistics.hotel_phone}
              </a>
            )}

            {/* Map link */}
            {hotelMapUrl && <MapLink url={hotelMapUrl} label="Open in Maps" />}

            {/* Notes — muted, below action links */}
            {logistics.hotel_notes && (
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">{logistics.hotel_notes}</p>
            )}
          </LogisticsCard>
        )}

        {logistics.parking_details && (
          <LogisticsCard icon="local_parking">
            <p className="font-semibold text-dark mb-1">Parking</p>
            <p className="text-sm text-medium-gray leading-relaxed">{logistics.parking_details}</p>
            {parkingMapUrl && <MapLink url={parkingMapUrl} label="View Location in Maps" />}
          </LogisticsCard>
        )}

        {logistics.meeting_room_details && (
          <LogisticsCard icon="door_open">
            <p className="font-semibold text-dark mb-1">Meeting Room</p>
            <p className="text-sm text-medium-gray leading-relaxed">{logistics.meeting_room_details}</p>
          </LogisticsCard>
        )}

        {logistics.meetup_instructions && (
          <LogisticsCard icon="info">
            <p className="font-semibold text-dark mb-1">Meetup Instructions</p>
            <p className="text-sm text-medium-gray leading-relaxed">{logistics.meetup_instructions}</p>
          </LogisticsCard>
        )}
      </div>
    </section>
  );
}

// --- generateMetadata --------------------------------------------------------

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const workshop = await getPublicWorkshop(id);
  if (!workshop) {
    return { title: 'Workshop Not Found | Wayfield' };
  }

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

// --- Page --------------------------------------------------------------------

export default async function PublicWorkshopPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const workshop = await getPublicWorkshop(id);

  if (!workshop) notFound();

  const standardSessions = workshop.sessions.filter(s => !s.is_addon);
  const addonSessions = workshop.sessions.filter(s => s.is_addon);

  const locationLine = [
    workshop.default_location?.city,
    workshop.default_location?.state_or_region,
  ].filter(Boolean).join(', ');

  const dateRange = formatDateRange(workshop.start_date, workshop.end_date, workshop.timezone);

  return (
    <>
      {/* Hero */}
      <div className="relative overflow-hidden" style={{ minHeight: '420px' }}>
        {workshop.hero_image_url ? (
          <img
            src={workshop.hero_image_url}
            alt={workshop.title}
            className="absolute inset-0 w-full h-full object-cover"
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
                    <SessionCard key={session.id} session={session} timezone={workshop.timezone} />
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
                    <SessionCard key={session.id} session={session} timezone={workshop.timezone} showAddonBadge />
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

      {/* Logistics */}
      {(workshop.logistics || workshop.default_location) && (
        <LogisticsSection
          logistics={workshop.logistics ?? {}}
          defaultLocation={workshop.default_location}
        />
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

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublicWorkshop, type PublicLeader, type PublicSession, type PublicLogistics } from '@/lib/api/public';

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

function LogisticsSection({ logistics }: { logistics: PublicLogistics }) {
  const hasAny = Object.values(logistics).some(Boolean);
  if (!hasAny) return null;

  return (
    <section className="max-w-4xl mx-auto px-6 py-16">
      <h2 className="font-heading text-2xl font-bold text-dark mb-8">Venue &amp; Logistics</h2>
      <div className="bg-white rounded-xl border border-border-gray shadow-sm divide-y divide-border-gray">
        {logistics.hotel_name && (
          <div className="p-6 flex gap-4">
            <span className="material-symbols-outlined text-primary text-xl shrink-0">hotel</span>
            <div>
              <p className="font-semibold text-dark">{logistics.hotel_name}</p>
              {logistics.hotel_address && (
                <p className="text-sm text-medium-gray mt-0.5">{logistics.hotel_address}</p>
              )}
              {logistics.hotel_phone && (
                <p className="text-sm text-medium-gray mt-0.5">{logistics.hotel_phone}</p>
              )}
              {logistics.hotel_notes && (
                <p className="text-sm text-medium-gray mt-2 leading-relaxed">{logistics.hotel_notes}</p>
              )}
            </div>
          </div>
        )}
        {logistics.parking_details && (
          <div className="p-6 flex gap-4">
            <span className="material-symbols-outlined text-primary text-xl shrink-0">local_parking</span>
            <div>
              <p className="font-semibold text-dark mb-1">Parking</p>
              <p className="text-sm text-medium-gray leading-relaxed">{logistics.parking_details}</p>
            </div>
          </div>
        )}
        {logistics.meeting_room_details && (
          <div className="p-6 flex gap-4">
            <span className="material-symbols-outlined text-primary text-xl shrink-0">door_open</span>
            <div>
              <p className="font-semibold text-dark mb-1">Meeting Room</p>
              <p className="text-sm text-medium-gray leading-relaxed">{logistics.meeting_room_details}</p>
            </div>
          </div>
        )}
        {logistics.meetup_instructions && (
          <div className="p-6 flex gap-4">
            <span className="material-symbols-outlined text-primary text-xl shrink-0">info</span>
            <div>
              <p className="font-semibold text-dark mb-1">Meetup Instructions</p>
              <p className="text-sm text-medium-gray leading-relaxed">{logistics.meetup_instructions}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── generateMetadata ────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const workshop = await getPublicWorkshop(slug);
  if (!workshop) {
    return { title: 'Workshop Not Found | Wayfield' };
  }
  return {
    title: `${workshop.title} | Wayfield`,
    description: workshop.description.slice(0, 160),
    openGraph: {
      title: workshop.title,
      description: workshop.description.slice(0, 160),
      ...(workshop.hero_image_url ? { images: [workshop.hero_image_url] } : {}),
    },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PublicWorkshopPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const workshop = await getPublicWorkshop(slug);

  if (!workshop) notFound();

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
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-white text-primary font-bold px-6 py-3 rounded-lg shadow-lg hover:bg-white/90 active:scale-[0.98] transition-all text-sm"
            >
              <span className="material-symbols-outlined text-base">key</span>
              Join with a code
            </Link>
          </div>
        </div>
      </div>

      {/* About */}
      {(workshop.description || workshop.body_content) && (
        <section className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="font-heading text-2xl font-bold text-dark mb-6">About This Workshop</h2>
          <p className="text-medium-gray leading-relaxed text-base mb-6">{workshop.description}</p>
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
            <h2 className="font-heading text-2xl font-bold text-dark mb-8">Schedule</h2>
            <div className="space-y-3">
              {workshop.sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white rounded-xl border border-border-gray p-5 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <DeliveryBadge type={session.delivery_type} />
                      {session.track_name && (
                        <span className="text-xs text-medium-gray font-medium">{session.track_name}</span>
                      )}
                    </div>
                    <p className="font-semibold text-dark">{session.title}</p>
                    <p className="text-sm text-medium-gray mt-0.5">
                      {formatSessionTime(session.start_at, session.end_at, workshop.timezone)}
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
              ))}
            </div>
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
      {workshop.logistics && <LogisticsSection logistics={workshop.logistics} />}

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

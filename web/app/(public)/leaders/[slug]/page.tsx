import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  getPublicLeader,
  getSitemapLeaders,
} from '@/lib/api/public';
import { buildLeaderMetadata } from '@/lib/seo/metadata';
import { buildPersonJsonLd, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const leaders = await getSitemapLeaders();
    return leaders.map((l) => ({ slug: l.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const leader = await getPublicLeader(slug);
  if (!leader) return { title: 'Not Found' };
  return buildLeaderMetadata(leader);
}

export default async function LeaderProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const leader = await getPublicLeader(slug);

  if (!leader) notFound();

  // Safe fields only — email, phone_number, address_line_1, postal_code absent from type
  const name = `${leader.first_name} ${leader.last_name}`;

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Leaders', href: '/leaders' },
    { label: name, href: `/leaders/${leader.slug}` },
  ];

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
      <Breadcrumbs items={breadcrumbItems} />
      <JsonLd data={buildPersonJsonLd(leader)} />
      <JsonLd
        data={buildBreadcrumbJsonLd(
          breadcrumbItems.map((i) => ({
            name: i.label,
            url: `https://wayfield.app${i.href}`,
          }))
        )}
      />

      <section style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {leader.profile_image_url && (
          <Image
            src={leader.profile_image_url}
            alt={`${name}, Workshop Leader`}
            width={180}
            height={180}
            priority
            style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        )}

        <div>
          <h1 style={{ fontFamily: 'Sora, sans-serif', margin: '0 0 0.5rem' }}>
            {name}
          </h1>

          {/* city and state_or_region only — full address intentionally absent */}
          {(leader.city || leader.state_or_region) && (
            <p style={{ color: '#7EA8BE', fontFamily: 'Plus Jakarta Sans, sans-serif', margin: '0 0 1rem' }}>
              {[leader.city, leader.state_or_region].filter(Boolean).join(', ')}
            </p>
          )}

          {leader.bio && (
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', lineHeight: 1.7 }}>
              {leader.bio}
            </p>
          )}

          {leader.website_url && (
            <a
              href={leader.website_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0FA3B1', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              Visit Website ↗
            </a>
          )}
        </div>
      </section>

      {/* email, phone_number, address_line_1, postal_code intentionally absent */}

      {leader.confirmed_workshops.length > 0 && (
        <section style={{ marginTop: '3rem' }}>
          <h2 style={{ fontFamily: 'Sora, sans-serif' }}>Upcoming Workshops</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {leader.confirmed_workshops.slice(0, 6).map((w) => (
              <li key={w.public_slug} style={{ marginBottom: '0.75rem' }}>
                <Link
                  href={`/workshops/${w.public_slug}`}
                  style={{ color: '#0FA3B1', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 500 }}
                >
                  {w.title}
                </Link>
                <span style={{ color: '#7EA8BE', marginLeft: '0.75rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
                  {new Date(w.start_date).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

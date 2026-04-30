import { notFound } from 'next/navigation';
import { getPublicOrganizer } from '@/lib/api/public';
import { buildOrganizationJsonLd, buildBreadcrumbJsonLd } from '@/lib/seo/jsonld';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import type { Metadata } from 'next';

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const organizer = await getPublicOrganizer(slug);
  if (!organizer) return { title: 'Not Found' };
  return {
    title: `${organizer.name} | Wayfield`,
    alternates: { canonical: `https://wayfield.app/organizers/${slug}` },
  };
}

export default async function OrganizerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const organizer = await getPublicOrganizer(slug);

  if (!organizer) notFound();

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: organizer.name, href: `/organizers/${slug}` },
  ];

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <Breadcrumbs items={breadcrumbItems} />
      <JsonLd data={buildOrganizationJsonLd()} />
      <JsonLd
        data={buildBreadcrumbJsonLd(
          breadcrumbItems.map((i) => ({
            name: i.label,
            url: `https://wayfield.app${i.href}`,
          }))
        )}
      />

      <h1 style={{ fontFamily: 'Sora, sans-serif' }}>{organizer.name}</h1>

      {/* primary_contact_email and primary_contact_phone intentionally absent */}

      <p style={{ color: '#7EA8BE', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
        {organizer.workshops.length} workshop{organizer.workshops.length !== 1 ? 's' : ''}
      </p>

      {organizer.workshops.length === 0 ? (
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          No workshops available at this time.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '1.5rem' }}>
          {organizer.workshops.map((w) => (
            <li key={w.public_slug} style={{ marginBottom: '0.75rem' }}>
              <a
                href={`/workshops/${w.public_slug}`}
                style={{ color: '#0FA3B1', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 500 }}
              >
                {w.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

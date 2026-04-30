import { notFound } from 'next/navigation';
import {
  getPublicCategoryByLocation,
  getSitemapCategories,
} from '@/lib/api/public';
import { buildCategoryMetadata } from '@/lib/seo/metadata';
import { buildBreadcrumbJsonLd } from '@/lib/seo/jsonld';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const categories = await getSitemapCategories();
    return categories.map((c) => ({ category: c.slug, location: '_' }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; location: string }>;
}) {
  const { category, location } = await params;
  const data = await getPublicCategoryByLocation(category, location);
  if (!data) return { title: 'Not Found' };
  return buildCategoryMetadata(data.category, data.location, location);
}

export default async function CategoryLocationPage({
  params,
}: {
  params: Promise<{ category: string; location: string }>;
}) {
  const { category, location } = await params;
  const data = await getPublicCategoryByLocation(category, location);

  if (!data) notFound();

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Workshops', href: '/workshops' },
    { label: data.category.name, href: `/workshops/${data.category.slug}` },
    {
      label: data.location,
      href: `/workshops/${data.category.slug}/${location}`,
    },
  ];

  return (
    <main>
      <Breadcrumbs items={breadcrumbItems} />
      <JsonLd
        data={buildBreadcrumbJsonLd(
          breadcrumbItems.map((i) => ({
            name: i.label,
            url: `https://wayfield.app${i.href}`,
          }))
        )}
      />

      <h1 style={{ fontFamily: 'Sora, sans-serif' }}>
        {data.category.name} Workshops in {data.location}
      </h1>

      {data.category.description && (
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {data.category.description}
        </p>
      )}

      <p style={{ color: '#7EA8BE', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
        {data.workshops.meta.total} workshop{data.workshops.meta.total !== 1 ? 's' : ''} found
      </p>

      {/* Workshop cards — data.workshops.data available for a future grid component */}
      {data.workshops.data.length === 0 && (
        <p>No {data.category.name.toLowerCase()} workshops found in {data.location}.</p>
      )}
    </main>
  );
}

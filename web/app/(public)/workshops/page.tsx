import { Suspense } from 'react';
import { DiscoverClient } from './DiscoverClient';
import { getPublicCategories } from '@/lib/api/public';
import { buildWorkshopsListingMetadata } from '@/lib/seo/metadata';
import { buildOrganizationJsonLd } from '@/lib/seo/jsonld';
import { JsonLd } from '@/components/seo/JsonLd';

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const { category, page } = await searchParams;
  const pageNum = page ? Number(page) : undefined;

  // If a category filter is active, look up its display name
  // so the title reads "Photography Workshops" not "photography Workshops"
  if (category) {
    try {
      const categories = await getPublicCategories();
      const active = categories?.find((c) => c.slug === category);
      if (active) {
        return buildWorkshopsListingMetadata(pageNum, active.name, active.slug);
      }
    } catch {
      // Fall through to default if categories can't be fetched
    }
  }

  return buildWorkshopsListingMetadata(pageNum);
}

export default function DiscoverPage() {
  return (
    <>
      <JsonLd data={buildOrganizationJsonLd()} />
      {/* existing Suspense + DiscoverClient — do not remove */}
      <Suspense>
        <DiscoverClient />
      </Suspense>
    </>
  );
}

import { Suspense } from 'react';
import { DiscoverClient } from './DiscoverClient';
import { buildWorkshopsListingMetadata } from '@/lib/seo/metadata';
import { buildOrganizationJsonLd } from '@/lib/seo/jsonld';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return buildWorkshopsListingMetadata(page ? Number(page) : undefined);
}

export default function DiscoverPage() {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Workshops', href: '/workshops' },
        ]}
      />
      <JsonLd data={buildOrganizationJsonLd()} />
      {/* existing Suspense + DiscoverClient — do not remove */}
      <Suspense>
        <DiscoverClient />
      </Suspense>
    </>
  );
}

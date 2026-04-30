import type { Metadata } from 'next';
import type {
  WorkshopListItem,
  WorkshopCategory,
  LeaderProfilePublic,
} from '@/lib/api/public';

// Import the full WorkshopDetail type from existing public.ts
// Use PublicWorkshop if that is what getPublicWorkshop returns
import type { PublicWorkshop } from '@/lib/api/public';

const SITE_URL = 'https://wayfield.app';
const DEFAULT_OG_IMAGE = `${SITE_URL}/images/og-default.jpg`;

export function buildWorkshopMetadata(workshop: PublicWorkshop): Metadata {
  // Use seo_title if the API returns it, otherwise fall back to title
  const title = (workshop as any).seo_title ?? workshop.title;
  const description =
    (workshop as any).seo_description ?? workshop.description?.slice(0, 160) ?? '';
  const slug = (workshop as any).public_slug ?? (workshop as any).slug ?? '';
  const url = `${SITE_URL}/workshops/${slug}`;
  const image = (workshop as any).seo_image_url ?? DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'Wayfield',
      images: [{ url: image }],
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  };
}

export function buildCategoryMetadata(
  category: WorkshopCategory,
  location?: string,
  locationSlug?: string
): Metadata {
  const title =
    category.seo_title ??
    (location
      ? `${category.name} Workshops in ${location} | Wayfield`
      : `${category.name} Workshops | Wayfield`);

  const description =
    category.seo_description ??
    (location
      ? `Find ${category.name.toLowerCase()} workshops in ${location} on Wayfield.`
      : `Browse ${category.name.toLowerCase()} workshops on Wayfield.`);

  const url =
    location && locationSlug
      ? `${SITE_URL}/workshops/${category.slug}/${locationSlug}`
      : `${SITE_URL}/workshops/${category.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'Wayfield' },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  };
}

export function buildLeaderMetadata(leader: LeaderProfilePublic): Metadata {
  const name = `${leader.first_name} ${leader.last_name}`;
  const title = `${name} | Workshop Leader | Wayfield`;
  const description = leader.bio?.slice(0, 160) ?? `${name} is a workshop leader on Wayfield.`;
  const url = `${SITE_URL}/leaders/${leader.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: 'Wayfield',
      images: leader.profile_image_url
        ? [{ url: leader.profile_image_url }]
        : [{ url: DEFAULT_OG_IMAGE }],
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  };
}

export function buildWorkshopsListingMetadata(
  page?: number,
  categoryName?: string,
  categorySlug?: string,
): Metadata {
  // When a category is active, title reflects it
  const title = categoryName
    ? `${categoryName} Workshops | Wayfield`
    : 'Workshops | Wayfield';

  const description = categoryName
    ? `Browse ${categoryName.toLowerCase()} workshops on Wayfield.`
    : 'Discover photography workshops, creative education events, and immersive learning experiences led by professional photographers on Wayfield.';

  // Canonical logic:
  // - No category: canonical is /workshops (or /workshops?page=N for paginated)
  // - Category active: canonical points to the DEDICATED category page /workshops/[slug]
  //   This tells Google the authoritative URL for this content is the category page,
  //   preventing the ?category= query param from competing with it in search results.
  const canonical = categorySlug
    ? `${SITE_URL}/workshops/${categorySlug}`
    : page && page > 1
    ? `${SITE_URL}/workshops?page=${page}`
    : `${SITE_URL}/workshops`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      siteName: 'Wayfield',
      images: [{ url: DEFAULT_OG_IMAGE }],
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  };
}

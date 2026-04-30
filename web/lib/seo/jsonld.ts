import type { PublicWorkshop } from '@/lib/api/public';
import type { LeaderProfilePublic } from '@/lib/api/public';

const SITE_URL = 'https://wayfield.app';

export function buildEventJsonLd(workshop: PublicWorkshop): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: workshop.title,
    description: workshop.description ?? '',
    startDate: workshop.start_date ?? (workshop as any).start_date,
    endDate: workshop.end_date ?? (workshop as any).end_date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: `${SITE_URL}/workshops/${(workshop as any).public_slug ?? (workshop as any).slug ?? ''}`,
    ...((workshop as any).seo_image_url && {
      image: (workshop as any).seo_image_url,
    }),
    ...(workshop.default_location && {
      location: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          // city and state_or_region only — never street address
          addressLocality: workshop.default_location.city,
          addressRegion: workshop.default_location.state_or_region,
        },
      },
    }),
    performer: (workshop.leaders ?? []).map((l: any) => ({
      '@type': 'Person',
      name: l.display_name ?? `${l.first_name} ${l.last_name}`,
      ...(l.slug && { url: `${SITE_URL}/leaders/${l.slug}` }),
    })),
    // meeting_url intentionally absent — never in public JSON-LD
  };
}

export function buildPersonJsonLd(leader: LeaderProfilePublic): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: `${leader.first_name} ${leader.last_name}`,
    jobTitle: 'Workshop Leader',
    url: `${SITE_URL}/leaders/${leader.slug}`,
    ...(leader.bio && { description: leader.bio }),
    ...(leader.profile_image_url && { image: leader.profile_image_url }),
    ...(leader.website_url && { sameAs: leader.website_url }),
    ...(leader.city && {
      address: {
        '@type': 'PostalAddress',
        // city and state only — never full street address
        addressLocality: leader.city,
        ...(leader.state_or_region && { addressRegion: leader.state_or_region }),
      },
    }),
    // phone_number, address_line_1, postal_code intentionally absent
  };
}

export function buildOrganizationJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Wayfield',
    url: SITE_URL,
    logo: `${SITE_URL}/images/wayfield-logo.png`,
  };
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

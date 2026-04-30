import { cache } from 'react';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

// Public-safe allowed fields on sessions (never expose meeting credentials)
export interface PublicSession {
  id: number;
  title: string;
  start_at: string;
  end_at: string;
  delivery_type: 'in_person' | 'virtual' | 'hybrid';
  location_city?: string;
  location_state?: string;
  track_name?: string;
  is_addon?: boolean;
  // meeting_url, meeting_id, meeting_passcode are intentionally absent
}

// Public-safe leader fields (no email, phone, or full address)
export interface PublicLeader {
  id: number;
  first_name: string;
  last_name: string;
  display_name?: string;
  bio?: string;
  profile_image_url?: string;
  website_url?: string;
  city?: string;
  state_or_region?: string;
  // email, phone_number, address_line_1, address_line_2, postal_code, country are intentionally absent
}

export interface PublicHotelAddressObject {
  formatted_address?: string;
  address_line_1?: string;
  address_line_2?: string;
  locality?: string;
  administrative_area?: string;
  postal_code?: string;
  country_code?: string;
  country_name?: string;
}

export interface PublicLogistics {
  hotel_name?: string;
  hotel_address?: string;
  hotel_address_object?: PublicHotelAddressObject;
  hotel_phone?: string;
  hotel_notes?: string;
  parking_details?: string;
  meeting_room_details?: string;
  meetup_instructions?: string;
}

export interface PublicLocation {
  name?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state_or_region?: string;
  postal_code?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface WorkshopPricingNextChange {
  price_cents: number;
  tier_label: string | null;
  changes_at: string | null;
  changes_at_capacity: number | null;
  urgency: 'urgent' | 'soon' | 'none';
  change_direction: 'increase' | 'decrease' | 'change';
}

export interface WorkshopPricingDisplay {
  current_price_cents: number;
  current_tier_label: string | null;
  is_tier_price: boolean;
  show_original_price: boolean;
  base_price_cents: number;
  next_price_change: WorkshopPricingNextChange | null;
  remaining_at_current_price: number | null;
}

export interface PublicWorkshop {
  id: number;
  title: string;
  description: string;
  public_summary?: string | null;
  workshop_type: 'session_based' | 'event_based';
  start_date: string;
  end_date: string;
  timezone: string;
  public_slug: string;
  public_page_is_indexable: boolean;
  canonical_url: string;
  social_share_title?: string | null;
  social_share_description?: string | null;
  social_share_image_url?: string | null;
  hero_image_url?: string;
  hero_title?: string;
  hero_subtitle?: string;
  body_content?: string;
  default_location?: PublicLocation;
  sessions: PublicSession[];
  leaders: PublicLeader[];
  logistics?: PublicLogistics;
  pricing?: WorkshopPricingDisplay | null;
  organization?: { id: number; slug: string } | null;
}

export interface DiscoverWorkshopTaxonomy {
  category: { id: number; name: string; slug: string } | null;
  subcategory: { id: number; name: string; slug: string } | null;
  specialization: { id: number; name: string; slug: string } | null;
}

export interface DiscoverWorkshopTag {
  id: number;
  group_key: string;
  value: string;
  label: string;
}

export interface DiscoverWorkshop {
  id: number;
  title: string;
  description: string;
  workshop_type: 'session_based' | 'event_based';
  start_date: string;
  end_date: string;
  public_slug: string | null;
  hero_image_url?: string | null;
  default_location?: { city?: string | null; state_or_region?: string | null } | null;
  taxonomy?: DiscoverWorkshopTaxonomy | null;
  tags?: DiscoverWorkshopTag[];
  organization?: { id: number; slug: string; name: string } | null;
  leader_count: number;
  pricing?: WorkshopPricingDisplay | null;
  // Legacy fields kept for backwards compat
  location?: { city?: string; state_or_region?: string };
  session_count?: number;
  first_leader?: { first_name: string; last_name: string; profile_image_url?: string | null };
  spots_remaining?: number | null;
  category?: string;
}

export interface DiscoverResponse {
  data: DiscoverWorkshop[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

async function publicFetch<T>(
  path: string,
  options?: { next?: { revalidate?: number; tags?: string[] } },
): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
      next: options?.next ?? { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export const getPublicWorkshop = cache(async function getPublicWorkshop(
  slug: string,
): Promise<PublicWorkshop | null> {
  return publicFetch<PublicWorkshop>(`/public/workshops/${slug}`, {
    next: { revalidate: 600, tags: [`workshop:${slug}`] },
  });
});

export async function discoverWorkshops(params: {
  search?: string;
  type?: string;
  date_from?: string;
  date_to?: string;
  category?: string;
  page?: number;
}): Promise<DiscoverResponse | null> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.type && params.type !== 'all') qs.set('type', params.type);
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.date_to) qs.set('date_to', params.date_to);
  if (params.category && params.category !== 'All') qs.set('category', params.category);
  qs.set('page', String(params.page ?? 1));
  qs.set('per_page', '12');
  const query = qs.toString();
  return publicFetch<DiscoverResponse>(`/discover/workshops${query ? `?${query}` : ''}`);
}

export interface DiscoverFilters {
  q?: string;
  category?: string;
  subcategory?: string;
  specialization?: string;
  tags?: string[];
  start_after?: string;
  start_before?: string;
  location?: string;
  price_min?: number;
  price_max?: number;
  per_page?: number;
  page?: number;
  sort?: 'newest' | 'start_date' | 'relevance';
}

export async function discoverWorkshopsV2(
  filters: DiscoverFilters,
): Promise<DiscoverResponse | null> {
  const qs = new URLSearchParams();
  if (filters.q) qs.set('q', filters.q);
  if (filters.category) qs.set('category', filters.category);
  if (filters.subcategory) qs.set('subcategory', filters.subcategory);
  if (filters.specialization) qs.set('specialization', filters.specialization);
  filters.tags?.forEach((t) => qs.append('tag[]', t));
  if (filters.start_after) qs.set('start_after', filters.start_after);
  if (filters.start_before) qs.set('start_before', filters.start_before);
  if (filters.location) qs.set('location', filters.location);
  if (filters.price_min !== undefined && filters.price_min > 0) qs.set('price_min', String(filters.price_min));
  if (filters.price_max !== undefined && filters.price_max < 2500) qs.set('price_max', String(filters.price_max));
  qs.set('per_page', String(filters.per_page ?? 12));
  qs.set('page', String(filters.page ?? 1));
  if (filters.sort) qs.set('sort', filters.sort);
  const query = qs.toString();
  return publicFetch<DiscoverResponse>(`/public/workshops${query ? `?${query}` : ''}`);
}

// --- SEO public types ---
// These extend the existing public API surface for SEO pages.
// Prohibited fields must never appear: meeting_url, meeting_id, meeting_passcode,
// phone_number, address_line_1, address_line_2, postal_code

export interface WorkshopListItem {
  id: number;
  title: string;
  public_slug: string;
  workshop_type: 'session_based' | 'event_based';
  start_date: string;
  end_date: string;
  timezone: string;
  location: {
    city: string | null;
    state_or_region: string | null;
    country: string | null;
  } | null;
  categories: Array<{ name: string; slug: string }>;
  seo_title: string | null;
  seo_description: string | null;
  seo_image_url: string | null;
  updated_at: string;
}

export interface WorkshopCategory {
  name: string;
  slug: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  workshops_count: number | null;
}

export interface CategoryWithWorkshops {
  category: WorkshopCategory;
  workshops: PaginatedResponse<WorkshopListItem>;
}

export interface CategoryLocationPage {
  category: WorkshopCategory;
  location: string;
  location_slug: string;
  workshops: PaginatedResponse<WorkshopListItem>;
}

export interface LeaderProfilePublic {
  first_name: string;
  last_name: string;
  display_name: string | null;
  slug: string;
  bio: string | null;
  profile_image_url: string | null;
  website_url: string | null;
  city: string | null;
  state_or_region: string | null;
  confirmed_workshops: Array<{
    title: string;
    public_slug: string;
    start_date: string;
  }>;
  // email, phone_number, address fields intentionally absent
}

export interface OrganizerProfilePublic {
  name: string;
  slug: string;
  workshops: WorkshopListItem[];
  // primary_contact_email, primary_contact_phone intentionally absent
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
}

export interface SitemapWorkshop {
  slug: string;
  updated_at: string;
  priority: number;
}

export interface SitemapCategory {
  slug: string;
  updated_at: string;
  count: number;
}

export interface SitemapLeader {
  slug: string;
  updated_at: string;
}

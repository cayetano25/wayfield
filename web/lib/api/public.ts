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

export interface PublicWorkshop {
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
}

export interface DiscoverWorkshop {
  id: number;
  title: string;
  description: string;
  workshop_type: 'session_based' | 'event_based';
  start_date: string;
  end_date: string;
  public_slug: string | null;
  hero_image_url?: string;
  location?: {
    city?: string;
    state_or_region?: string;
  };
  leader_count: number;
  session_count: number;
  // Extended fields for discover page UI
  first_leader?: {
    first_name: string;
    last_name: string;
    profile_image_url?: string | null;
  };
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

async function publicFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

export async function getPublicWorkshop(slug: string): Promise<PublicWorkshop | null> {
  return publicFetch<PublicWorkshop>(`/public/workshops/${slug}`);
}

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

import { describe, it, expect } from 'vitest';
import {
  buildWorkshopsListingMetadata,
  buildCategoryMetadata,
  buildLeaderMetadata,
} from '../metadata';

// Minimal mock objects matching existing API types
const mockWorkshopCategory = {
  name: 'Photography',
  slug: 'photography',
  description: 'Photography workshops',
  seo_title: null,
  seo_description: null,
  workshops_count: 5,
};

const mockLeader = {
  first_name: 'Jane',
  last_name: 'Doe',
  display_name: null,
  slug: 'jane-doe',
  bio: 'Jane is an award-winning photographer with 15 years of experience.',
  profile_image_url: 'https://cdn.example.com/jane.jpg',
  website_url: 'https://janedoe.com',
  city: 'Minneapolis',
  state_or_region: 'Minnesota',
  confirmed_workshops: [],
};

describe('buildWorkshopsListingMetadata', () => {
  it('returns correct title', () => {
    const meta = buildWorkshopsListingMetadata();
    // Updated: no longer "Photography Workshops" — that's for category pages
    expect(meta.title).toBe('Workshops | Wayfield');
  });

  it('returns canonical URL for first page', () => {
    const meta = buildWorkshopsListingMetadata();
    expect((meta.alternates as any)?.canonical).toBe('https://wayfield.app/workshops');
  });

  it('returns paginated canonical URL for subsequent pages', () => {
    const meta = buildWorkshopsListingMetadata(2);
    expect((meta.alternates as any)?.canonical).toBe('https://wayfield.app/workshops?page=2');
  });

  it('returns category title when categoryName is provided', () => {
    const meta = buildWorkshopsListingMetadata(undefined, 'Photography', 'photography');
    expect(meta.title).toBe('Photography Workshops | Wayfield');
  });

  it('sets canonical to category page when category is active', () => {
    const meta = buildWorkshopsListingMetadata(undefined, 'Photography', 'photography');
    expect((meta.alternates as any)?.canonical).toBe(
      'https://wayfield.app/workshops/photography'
    );
  });

  it('sets canonical to /workshops when no category is active', () => {
    const meta = buildWorkshopsListingMetadata();
    expect((meta.alternates as any)?.canonical).toBe('https://wayfield.app/workshops');
  });
});

describe('buildCategoryMetadata', () => {
  it('constructs title without location', () => {
    const meta = buildCategoryMetadata(mockWorkshopCategory);
    expect(meta.title).toContain('Photography Workshops');
    expect(meta.title).toContain('Wayfield');
  });

  it('constructs title with location', () => {
    const meta = buildCategoryMetadata(mockWorkshopCategory, 'Minnesota', 'minnesota');
    expect(meta.title).toContain('Minnesota');
    expect(meta.title).toContain('Photography');
  });

  it('uses seo_title when set', () => {
    const withSeoTitle = { ...mockWorkshopCategory, seo_title: 'Custom SEO Title' };
    const meta = buildCategoryMetadata(withSeoTitle);
    expect(meta.title).toBe('Custom SEO Title');
  });

  it('sets canonical URL correctly for category', () => {
    const meta = buildCategoryMetadata(mockWorkshopCategory);
    expect((meta.alternates as any)?.canonical).toBe(
      'https://wayfield.app/workshops/photography'
    );
  });

  it('sets canonical URL correctly for category+location', () => {
    const meta = buildCategoryMetadata(mockWorkshopCategory, 'Minnesota', 'minnesota');
    expect((meta.alternates as any)?.canonical).toBe(
      'https://wayfield.app/workshops/photography/minnesota'
    );
  });
});

describe('buildLeaderMetadata', () => {
  it('generates correct title', () => {
    const meta = buildLeaderMetadata(mockLeader);
    expect(meta.title).toContain('Jane Doe');
    expect(meta.title).toContain('Wayfield');
  });

  it('uses bio for description', () => {
    const meta = buildLeaderMetadata(mockLeader);
    expect((meta as any).description).toContain('Jane');
  });

  it('generates correct canonical URL', () => {
    const meta = buildLeaderMetadata(mockLeader);
    expect((meta.alternates as any)?.canonical).toBe(
      'https://wayfield.app/leaders/jane-doe'
    );
  });

  it('uses default description when bio is null', () => {
    const noBio = { ...mockLeader, bio: null };
    const meta = buildLeaderMetadata(noBio);
    expect((meta as any).description).toBeTruthy();
  });
});

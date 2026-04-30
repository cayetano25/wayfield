import { describe, it, expect } from 'vitest';
import {
  buildPersonJsonLd,
  buildOrganizationJsonLd,
  buildBreadcrumbJsonLd,
} from '../jsonld';

const mockLeader = {
  first_name: 'Jane',
  last_name: 'Doe',
  display_name: null,
  slug: 'jane-doe',
  bio: 'Photography educator.',
  profile_image_url: 'https://cdn.example.com/jane.jpg',
  website_url: 'https://janedoe.com',
  city: 'Minneapolis',
  state_or_region: 'Minnesota',
  confirmed_workshops: [],
};

describe('buildPersonJsonLd', () => {
  it('returns @type Person', () => {
    const result = buildPersonJsonLd(mockLeader);
    expect((result as any)['@type']).toBe('Person');
  });

  it('includes correct name', () => {
    const result = buildPersonJsonLd(mockLeader) as any;
    expect(result.name).toBe('Jane Doe');
  });

  it('never includes phone_number', () => {
    const result = JSON.stringify(buildPersonJsonLd(mockLeader));
    expect(result).not.toContain('phone_number');
    expect(result).not.toContain('phone');
  });

  it('never includes address_line_1', () => {
    const result = JSON.stringify(buildPersonJsonLd(mockLeader));
    expect(result).not.toContain('address_line_1');
  });

  it('never includes postal_code', () => {
    const result = JSON.stringify(buildPersonJsonLd(mockLeader));
    expect(result).not.toContain('postal_code');
  });

  it('includes only city and state in address', () => {
    const result = buildPersonJsonLd(mockLeader) as any;
    expect(result.address.addressLocality).toBe('Minneapolis');
    expect(result.address.addressRegion).toBe('Minnesota');
    expect(result.address.streetAddress).toBeUndefined();
    expect(result.address.postalCode).toBeUndefined();
  });

  it('includes leader profile URL', () => {
    const result = buildPersonJsonLd(mockLeader) as any;
    expect(result.url).toBe('https://wayfield.app/leaders/jane-doe');
  });
});

describe('buildOrganizationJsonLd', () => {
  it('returns @type Organization', () => {
    const result = buildOrganizationJsonLd() as any;
    expect(result['@type']).toBe('Organization');
  });

  it('includes Wayfield name and URL', () => {
    const result = buildOrganizationJsonLd() as any;
    expect(result.name).toBe('Wayfield');
    expect(result.url).toBe('https://wayfield.app');
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it('returns @type BreadcrumbList', () => {
    const result = buildBreadcrumbJsonLd([
      { name: 'Home', url: 'https://wayfield.app/' },
      { name: 'Workshops', url: 'https://wayfield.app/workshops' },
    ]) as any;
    expect(result['@type']).toBe('BreadcrumbList');
  });

  it('assigns positions starting at 1', () => {
    const result = buildBreadcrumbJsonLd([
      { name: 'Home', url: 'https://wayfield.app/' },
      { name: 'Workshops', url: 'https://wayfield.app/workshops' },
      { name: 'Photography', url: 'https://wayfield.app/workshops/photography' },
    ]) as any;
    expect(result.itemListElement[0].position).toBe(1);
    expect(result.itemListElement[1].position).toBe(2);
    expect(result.itemListElement[2].position).toBe(3);
  });

  it('includes all item names', () => {
    const result = buildBreadcrumbJsonLd([
      { name: 'Home', url: 'https://wayfield.app/' },
      { name: 'Workshops', url: 'https://wayfield.app/workshops' },
    ]) as any;
    expect(result.itemListElement[0].name).toBe('Home');
    expect(result.itemListElement[1].name).toBe('Workshops');
  });
});

// Privacy regression tests — these must never be removed
describe('JSON-LD privacy enforcement', () => {
  it('buildPersonJsonLd output never contains meeting_url', () => {
    const output = JSON.stringify(buildPersonJsonLd(mockLeader));
    expect(output).not.toContain('meeting_url');
  });

  it('buildPersonJsonLd output never contains email field', () => {
    const output = JSON.stringify(buildPersonJsonLd(mockLeader));
    // Should not serialize an email field — only url (website) is acceptable
    expect(output).not.toContain('"email"');
  });
});

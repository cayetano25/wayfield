'use client';

import type { AddressFormData, AddressApiResponse } from '@/lib/types/address';
import { getCountryFlag } from '@/lib/utils/addresses';

interface FormattedAddressProps {
  address: AddressFormData | AddressApiResponse | null;
  showCountry?: boolean;
  compact?: boolean;
  className?: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  AU: 'Australia',
  NZ: 'New Zealand',
  IE: 'Ireland',
  JP: 'Japan',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  PT: 'Portugal',
  NL: 'Netherlands',
  BE: 'Belgium',
  AT: 'Austria',
  CH: 'Switzerland',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  MX: 'Mexico',
  BR: 'Brazil',
  AR: 'Argentina',
  CL: 'Chile',
  CO: 'Colombia',
  ZA: 'South Africa',
  NG: 'Nigeria',
  KE: 'Kenya',
  IN: 'India',
  CN: 'China',
  KR: 'South Korea',
  SG: 'Singapore',
  HK: 'Hong Kong',
  TH: 'Thailand',
  PH: 'Philippines',
  ID: 'Indonesia',
  MY: 'Malaysia',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  IL: 'Israel',
  TR: 'Turkey',
  PL: 'Poland',
  CZ: 'Czech Republic',
  HU: 'Hungary',
  RO: 'Romania',
  GR: 'Greece',
};

function getCountryName(code: string | undefined, address: AddressFormData | AddressApiResponse): string | null {
  if (!code) return null;
  if (address && typeof address === 'object' && 'country_name' in address && address.country_name) {
    return address.country_name;
  }
  return COUNTRY_NAMES[code] ?? code;
}

export function FormattedAddress({
  address,
  showCountry = true,
  compact = false,
  className = '',
}: FormattedAddressProps) {
  if (!address) return null;

  const {
    address_line_1,
    address_line_2,
    address_line_3,
    dependent_locality,
    locality,
    administrative_area,
    postal_code,
    country_code,
  } = address;

  const countryName = showCountry && country_code ? getCountryName(country_code, address) : null;

  if (compact) {
    const flag = getCountryFlag(country_code);
    const parts: string[] = [];
    if (address_line_1) parts.push(address_line_1);
    if (locality) {
      const cityState = [locality, administrative_area].filter(Boolean).join(', ');
      const withZip = [cityState, postal_code].filter(Boolean).join(' ');
      if (withZip) parts.push(withZip);
    }
    if (showCountry && countryName) parts.push(countryName);

    const line = parts.join(', ');
    if (!line) return null;

    return (
      <span className={className}>
        {flag} {line}
      </span>
    );
  }

  // Multi-line format
  const lines: string[] = [];
  if (address_line_1) lines.push(address_line_1);
  if (address_line_2) lines.push(address_line_2);
  if (address_line_3) lines.push(address_line_3);
  if (dependent_locality) lines.push(dependent_locality);

  if (locality) {
    if (country_code === 'US' || country_code === 'CA') {
      const cityLine = [locality, administrative_area].filter(Boolean).join(', ');
      const withZip = [cityLine, postal_code].filter(Boolean).join(' ');
      if (withZip) lines.push(withZip);
    } else {
      if (locality) lines.push(locality);
      if (administrative_area) lines.push(administrative_area);
      if (postal_code) lines.push(postal_code);
    }
  }

  if (showCountry && countryName) lines.push(countryName);

  if (lines.length === 0) return null;

  return (
    <div className={`text-sm text-dark leading-relaxed ${className}`}>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

import type { AddressFormData, CountryConfig } from '@/lib/types/address';

export function getCountryFlag(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function buildFormattedAddressPreview(data: Partial<AddressFormData>): string {
  if (!data.address_line_1 && !data.locality) return '';

  const parts: string[] = [];

  if (data.address_line_1) parts.push(data.address_line_1);
  if (data.address_line_2) parts.push(data.address_line_2);
  if (data.address_line_3) parts.push(data.address_line_3);
  if (data.dependent_locality) parts.push(data.dependent_locality);

  // US format: "City, State ZIP"
  if (data.country_code === 'US') {
    const cityLine = [
      data.locality,
      [data.administrative_area, data.postal_code].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join(', ');
    if (cityLine) parts.push(cityLine);
  } else {
    if (data.locality) {
      const localityParts = [data.locality, data.administrative_area]
        .filter(Boolean)
        .join(', ');
      const withPostal = [localityParts, data.postal_code].filter(Boolean).join(' ');
      if (withPostal) parts.push(withPostal);
    }
    if (data.sorting_code) parts.push(data.sorting_code);
  }

  return parts.join('\n');
}

export function validatePostalCode(
  postalCode: string,
  countryConfig: CountryConfig,
): boolean {
  if (!countryConfig.postal_code_format) return true;
  if (!postalCode) return !countryConfig.postal_code_required;

  const match = countryConfig.postal_code_format.match(/^\/(.*)\/([gimsuy]*)$/);
  if (!match) return true;

  const [, pattern, flags] = match;
  try {
    return new RegExp(pattern, flags).test(postalCode);
  } catch {
    return true;
  }
}

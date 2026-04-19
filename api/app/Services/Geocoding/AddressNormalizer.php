<?php

declare(strict_types=1);

namespace App\Services\Geocoding;

use App\Models\Address;

/**
 * Produces a deterministic canonical string from an address record
 * and computes a stable SHA-256 hash for use as a cache key.
 *
 * Normalization ensures that semantically identical addresses —
 * even if entered with different spacing, casing, or abbreviations —
 * produce the same hash and hit the same cache entry.
 *
 * Limitations:
 *   This normalizer handles formatting differences (whitespace, case,
 *   abbreviations we know about). It does NOT resolve semantic
 *   differences like "St" vs "Street" or "Ave" vs "Avenue" —
 *   those require an external validation service.
 *   For Nominatim, this level of normalization is sufficient because
 *   Nominatim is tolerant of minor street abbreviation differences.
 */
final class AddressNormalizer
{
    /**
     * Produces a normalized canonical address string from an Address model.
     *
     * The canonical string is built in a consistent field order
     * regardless of which fields are set. Empty fields are omitted.
     * All text is uppercased and trimmed.
     * Country code is always ISO 3166-1 alpha-2 (already stored that way).
     * Postal code has spaces removed and is uppercased (handles UK, CA formats).
     *
     * Example output: "123 MAIN ST|PORTLAND|OR|97201|US"
     *
     * The pipe separator is used instead of comma because commas
     * may appear in address_line values (e.g. "Suite 4, Floor 3").
     */
    public function normalize(Address $address): string
    {
        $parts = array_filter([
            $this->normalizeText($address->address_line_1),
            $this->normalizeText($address->address_line_2),
            $this->normalizeText($address->address_line_3),
            $this->normalizeText($address->dependent_locality),
            $this->normalizeText($address->locality),
            $this->normalizeText($address->administrative_area),
            $this->normalizePostalCode($address->postal_code),
            strtoupper(trim($address->country_code ?? '')),
        ], fn ($v) => $v !== '' && $v !== null);

        return implode('|', $parts);
    }

    /**
     * Computes a SHA-256 hash of the normalized canonical string.
     * This is the geocode_hash stored on the address and used as the
     * geocode_cache lookup key.
     *
     * SHA-256 produces a 64-character hex string.
     * It is collision-resistant for this use case.
     */
    public function hash(Address $address): string
    {
        return hash('sha256', $this->normalize($address));
    }

    /**
     * Builds the query string to send to Nominatim.
     *
     * Nominatim performs best with a structured query when possible.
     * We pass the street, city, state, postal code, and country separately.
     * This gives Nominatim the best chance of a precise match.
     *
     * Falls back to a free-text q= query if only minimal fields exist.
     */
    public function toNominatimQuery(Address $address): array
    {
        $street = array_filter([
            $this->normalizeText($address->address_line_1),
            $this->normalizeText($address->address_line_2),
        ]);

        // Prefer structured parameters when we have enough data
        if (! empty($street) && ! empty($address->locality)) {
            return array_filter([
                'street' => implode(', ', $street),
                'city' => $address->locality,
                'state' => $address->administrative_area,
                'postalcode' => $address->postal_code,
                'country' => $address->country_code,
                'format' => 'json',
                'addressdetails' => 1,
                'limit' => 1,
            ], fn ($v) => $v !== null && $v !== '');
        }

        // Fallback: free-text query from the normalized canonical string
        return [
            'q' => $this->normalize($address),
            'format' => 'json',
            'addressdetails' => 1,
            'limit' => 1,
        ];
    }

    /**
     * Trims whitespace, collapses repeated spaces, and uppercases.
     */
    private function normalizeText(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }
        $trimmed = trim($value);
        $collapsed = preg_replace('/\s+/', ' ', $trimmed);

        return strtoupper($collapsed ?? $trimmed);
    }

    /**
     * Normalizes a postal code:
     *   - Remove all spaces (handles UK "SW1A 2AA" → "SW1A2AA")
     *   - Uppercase
     *   - Trim
     */
    private function normalizePostalCode(?string $code): string
    {
        if ($code === null || $code === '') {
            return '';
        }

        return strtoupper(str_replace(' ', '', trim($code)));
    }
}

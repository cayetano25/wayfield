<?php

namespace App\Support;

class AddressFormatter
{
    // Countries that use "City, ST" abbreviation format.
    private const STATE_ABBREV_COUNTRIES = ['US', 'CA', 'AU', 'MX', 'BR', 'IN'];

    // Fallback names for non-standard/infrequent ISO codes not covered by intl.
    private const FALLBACK_NAMES = [
        'AQ' => 'Antarctica',
        'XA' => 'Arctic Region',
        'GL' => 'Greenland',
        'IS' => 'Iceland',
    ];

    public static function formatCityRegion(
        ?string $city,
        ?string $stateOrRegion,
        ?string $countryCode
    ): ?string {
        if (! $city) {
            return null;
        }

        $code = strtoupper($countryCode ?? '');

        if (in_array($code, self::STATE_ABBREV_COUNTRIES, true)) {
            return $stateOrRegion ? "{$city}, {$stateOrRegion}" : $city;
        }

        $countryName = self::countryName($countryCode);

        if ($stateOrRegion) {
            return $countryName
                ? "{$city}, {$stateOrRegion}, {$countryName}"
                : "{$city}, {$stateOrRegion}";
        }

        return $countryName ? "{$city}, {$countryName}" : $city;
    }

    public static function countryName(?string $code): ?string
    {
        if (! $code) {
            return null;
        }

        $upper = strtoupper($code);

        if (isset(self::FALLBACK_NAMES[$upper])) {
            return self::FALLBACK_NAMES[$upper];
        }

        if (class_exists('Locale')) {
            $name = \Locale::getDisplayRegion('-' . $upper, 'en');
            if ($name !== $upper) {
                return $name;
            }
        }

        return null;
    }
}

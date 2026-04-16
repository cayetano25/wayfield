<?php

namespace App\Services\Address;

use App\Models\Address;

class AddressService
{
    public function createFromRequest(array $data): Address
    {
        $formatted = $this->buildFormattedAddress($data, $data['country_code'] ?? 'US');

        $address = new Address;
        $address->fill($data);
        $address->formatted_address = $formatted;
        $address->validation_status = 'unverified';
        $address->save();

        return $address;
    }

    public function updateFromRequest(Address $address, array $data): Address
    {
        $address->fill($data);
        $address->formatted_address = $this->buildFormattedAddress(
            array_merge($address->toArray(), $data),
            $data['country_code'] ?? $address->country_code,
        );
        $address->save();

        return $address;
    }

    public function buildFormattedAddress(array $data, string $countryCode): string
    {
        $config = $this->getCountryConfig($countryCode);
        $format = $config['format'] ?? ['address_line_1', 'address_line_2', 'locality', 'administrative_area', 'postal_code'];

        $parts = [];

        // Build the address according to the country's format order
        foreach ($format as $field) {
            $value = $data[$field] ?? null;
            if ($value !== null && $value !== '') {
                $parts[] = trim((string) $value);
            }
        }

        if (empty($parts)) {
            return '';
        }

        // US format: inline with commas and spaces between city/state/zip
        if ($countryCode === 'US') {
            $line1 = $data['address_line_1'] ?? null;
            $line2 = $data['address_line_2'] ?? null;
            $city = $data['locality'] ?? null;
            $state = $data['administrative_area'] ?? null;
            $zip = $data['postal_code'] ?? null;

            $lines = [];
            if ($line1) {
                $lines[] = $line1.($line2 ? ', '.$line2 : '');
            }
            $cityStateZip = implode(', ', array_filter([
                $city,
                $state ? ($zip ? $state.' '.$zip : $state) : $zip,
            ]));
            if ($cityStateZip) {
                $lines[] = $cityStateZip;
            }
            $lines[] = $countryCode;

            return implode(', ', array_filter($lines));
        }

        // GB format: newline-separated
        if ($countryCode === 'GB') {
            $line1 = $data['address_line_1'] ?? null;
            $line2 = $data['address_line_2'] ?? null;
            $locality = $data['locality'] ?? null;
            $postcode = $data['postal_code'] ?? null;

            $lines = array_filter([
                $line1,
                $line2,
                trim(($locality ?? '').' '.($postcode ?? '')),
                $countryCode,
            ]);

            return implode("\n", $lines);
        }

        // Generic: join non-empty parts with commas, append country
        return implode(', ', array_filter(array_merge($parts, [$countryCode])));
    }

    public function getCountryConfig(string $countryCode): array
    {
        return config("address_countries.{$countryCode}") ?? [
            'postal_code_label' => 'Postal Code',
            'postal_code_format' => null,
            'postal_code_required' => false,
            'administrative_area_label' => 'State / Region',
            'administrative_area_required' => false,
            'administrative_area_options' => null,
            'locality_label' => 'City',
            'locality_required' => true,
            'dependent_locality_label' => null,
            'address_line_3_used' => false,
            'sorting_code_used' => false,
            'format' => ['address_line_1', 'address_line_2', 'locality', 'administrative_area', 'postal_code'],
        ];
    }

    public function inferCountryFromTimezone(string $timezone): string
    {
        return config("address_timezones.{$timezone}") ?? 'US';
    }

    public function validatePostalCode(string $postalCode, string $countryCode): bool
    {
        $country = $this->getCountryConfig($countryCode);

        if ($country['postal_code_format'] === null) {
            return true; // No validation rule for this country
        }

        if (empty($postalCode)) {
            return ! ($country['postal_code_required']);
        }

        return (bool) preg_match($country['postal_code_format'], $postalCode);
    }

    public function toApiResponse(Address $address): array
    {
        $response = [
            'country_code'      => $address->country_code,
            'country_name'      => $address->country_name,
            'formatted_address' => $address->formatted_address,
            'validation_status' => $address->validation_status,
            'has_coordinates'   => $address->hasCoordinates(),
        ];

        $optionalFields = [
            'address_line_1', 'address_line_2', 'address_line_3',
            'locality', 'administrative_area', 'dependent_locality',
            'postal_code', 'sorting_code',
        ];

        foreach ($optionalFields as $field) {
            if ($address->$field !== null) {
                $response[$field] = $address->$field;
            }
        }

        // Coordinates: only expose when present
        if ($address->hasCoordinates()) {
            $response['latitude']  = $address->latitude;
            $response['longitude'] = $address->longitude;
        }

        // Maps URLs: let the mobile app open native routing directly
        $mapsUrl      = $address->mapsUrl();
        $appleMapsUrl = $address->appleMapsUrl();

        if ($mapsUrl !== null) {
            $response['maps_url'] = $mapsUrl;
        }
        if ($appleMapsUrl !== null) {
            $response['apple_maps_url'] = $appleMapsUrl;
        }

        return $response;
    }
}

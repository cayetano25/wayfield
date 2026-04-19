<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Address extends Model
{
    use HasFactory;

    protected $fillable = [
        'country_code',
        'address_line_1',
        'address_line_2',
        'address_line_3',
        'locality',
        'administrative_area',
        'dependent_locality',
        'postal_code',
        'sorting_code',
        'formatted_address',
        'validation_status',
        'latitude',
        'longitude',
        'geocode_hash',
        'geocode_attempts',
        'last_geocoded_at',
        'geocode_error',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'last_geocoded_at' => 'datetime',
        'geocode_attempts' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * True if usable coordinates are stored on this address.
     */
    public function hasCoordinates(): bool
    {
        return $this->latitude !== null
            && $this->longitude !== null;
    }

    /**
     * True if geocoding should be attempted for this address.
     *
     * Conditions:
     *   - Has not been successfully geocoded yet (no coordinates)
     *   - Has not exceeded the max attempt limit (prevents retry storm)
     *   - Has enough address data to be worth trying
     */
    public function needsGeocoding(): bool
    {
        $max = config('services.geocoding.max_attempts', 3);

        return ! $this->hasCoordinates()
            && (int) $this->geocode_attempts < $max
            && $this->isGeocodeable();
    }

    /**
     * True if the address has enough data to send to Nominatim.
     *
     * Minimum viable address: at minimum one of these must be true:
     *   - address_line_1 is set (street address known)
     *   - locality AND country_code are set (city + country known)
     */
    public function isGeocodeable(): bool
    {
        return ! empty($this->address_line_1)
            || (! empty($this->locality) && ! empty($this->country_code));
    }

    /**
     * Returns a Google Maps URL suitable for use in mobile routing links.
     *
     * Priority:
     *   1. Use lat/lng for pinpoint accuracy (best for routing).
     *   2. Fall back to formatted_address text search.
     *   3. Return null if neither is available.
     */
    public function mapsUrl(): ?string
    {
        if ($this->hasCoordinates()) {
            return "https://www.google.com/maps?q={$this->latitude},{$this->longitude}";
        }
        if ($this->formatted_address) {
            $q = urlencode($this->formatted_address);

            return "https://www.google.com/maps?q={$q}";
        }

        return null;
    }

    /**
     * Returns an Apple Maps URL for iOS routing.
     */
    public function appleMapsUrl(): ?string
    {
        if ($this->hasCoordinates()) {
            return "https://maps.apple.com/?q={$this->latitude},{$this->longitude}";
        }
        if ($this->formatted_address) {
            $q = urlencode($this->formatted_address);

            return "https://maps.apple.com/?q={$q}";
        }

        return null;
    }

    /**
     * Returns the geocode cache entry linked to this address's hash.
     */
    public function geocodeCache(): HasOne
    {
        return $this->hasOne(GeocodeCache::class, 'geocode_hash', 'geocode_hash');
    }

    public function getCountryNameAttribute(): string
    {
        return config("address_countries.{$this->country_code}.name")
            ?? $this->country_code;
    }

    public function getCountryConfigAttribute(): array
    {
        return config("address_countries.{$this->country_code}")
            ?? $this->getGenericCountryConfig();
    }

    protected function getGenericCountryConfig(): array
    {
        return [
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
}

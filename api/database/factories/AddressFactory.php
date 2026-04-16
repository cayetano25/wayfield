<?php

namespace Database\Factories;

use App\Models\Address;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Address>
 */
class AddressFactory extends Factory
{
    protected $model = Address::class;

    public function definition(): array
    {
        return [
            'country_code'        => 'US',
            'address_line_1'      => $this->faker->streetAddress(),
            'address_line_2'      => null,
            'locality'            => $this->faker->city(),
            'administrative_area' => $this->faker->stateAbbr(),
            'postal_code'         => $this->faker->postcode(),
            'formatted_address'   => null,
            'validation_status'   => 'unverified',
            'geocode_attempts'    => 0,
            'latitude'            => null,
            'longitude'           => null,
        ];
    }

    /**
     * An address with enough data for Nominatim to geocode.
     * No coordinates yet — used to test the geocoding pipeline.
     */
    public function geocodeable(): static
    {
        return $this->state([
            'address_line_1'      => '123 Main St',
            'locality'            => 'Portland',
            'administrative_area' => 'OR',
            'postal_code'         => '97201',
            'country_code'        => 'US',
            'latitude'            => null,
            'longitude'           => null,
            'geocode_attempts'    => 0,
            'validation_status'   => 'unverified',
        ]);
    }

    /**
     * An address that has already been successfully geocoded.
     * Used to test cache hits and coordinate-based map URL generation.
     */
    public function withCoordinates(): static
    {
        return $this->state([
            'address_line_1'      => '123 Main St',
            'locality'            => 'Portland',
            'administrative_area' => 'OR',
            'postal_code'         => '97201',
            'country_code'        => 'US',
            'latitude'            => 45.5231,
            'longitude'           => -122.6765,
            'validation_status'   => 'verified',
            'geocode_attempts'    => 1,
            'last_geocoded_at'    => now(),
        ]);
    }
}

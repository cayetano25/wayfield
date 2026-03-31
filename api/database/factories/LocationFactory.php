<?php

namespace Database\Factories;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

class LocationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'name'            => $this->faker->company() . ' Venue',
            'address_line_1'  => $this->faker->streetAddress(),
            'address_line_2'  => null,
            'city'            => $this->faker->city(),
            'state_or_region' => $this->faker->stateAbbr(),
            'postal_code'     => $this->faker->postcode(),
            'country'         => 'US',
            'latitude'        => $this->faker->latitude(),
            'longitude'       => $this->faker->longitude(),
        ];
    }
}

<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class TaxonomyTagGroupFactory extends Factory
{
    public function definition(): array
    {
        $key = $this->faker->unique()->slug(2, '_');

        return [
            'key'             => str_replace('-', '_', $key),
            'label'           => ucwords(str_replace('_', ' ', $key)),
            'description'     => null,
            'allows_multiple' => true,
            'is_active'       => true,
            'sort_order'      => $this->faker->numberBetween(0, 100),
        ];
    }
}

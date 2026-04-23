<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class TaxonomyCategoryFactory extends Factory
{
    public function definition(): array
    {
        $name = $this->faker->unique()->words(2, true);

        return [
            'name'       => ucwords($name),
            'slug'       => Str::slug($name),
            'sort_order' => $this->faker->numberBetween(0, 100),
            'is_active'  => true,
        ];
    }
}

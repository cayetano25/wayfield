<?php

namespace Database\Factories;

use App\Models\TaxonomySubcategory;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class TaxonomySpecializationFactory extends Factory
{
    public function definition(): array
    {
        $name = $this->faker->unique()->words(3, true);

        return [
            'subcategory_id' => TaxonomySubcategory::factory(),
            'name'           => ucwords($name),
            'slug'           => Str::slug($name),
            'sort_order'     => $this->faker->numberBetween(0, 100),
            'is_active'      => true,
        ];
    }
}

<?php

namespace Database\Factories;

use App\Models\TaxonomyTagGroup;
use Illuminate\Database\Eloquent\Factories\Factory;

class TaxonomyTagFactory extends Factory
{
    public function definition(): array
    {
        $value = strtolower($this->faker->unique()->words(2, true));
        $value = preg_replace('/\s+/', '_', $value);

        return [
            'tag_group_id' => TaxonomyTagGroup::factory(),
            'value'        => $value,
            'label'        => ucwords(str_replace('_', ' ', $value)),
            'sort_order'   => $this->faker->numberBetween(0, 100),
            'is_active'    => true,
        ];
    }
}

<?php

namespace Database\Factories;

use App\Models\TaxonomyCategory;
use App\Models\Workshop;
use App\Models\WorkshopTaxonomy;
use Illuminate\Database\Eloquent\Factories\Factory;

class WorkshopTaxonomyFactory extends Factory
{
    protected $model = WorkshopTaxonomy::class;

    public function definition(): array
    {
        return [
            'workshop_id'       => Workshop::factory(),
            'category_id'       => TaxonomyCategory::factory(),
            'subcategory_id'    => null,
            'specialization_id' => null,
            'is_primary'        => true,
        ];
    }

    public function primary(): static
    {
        return $this->state(['is_primary' => true]);
    }
}

<?php

namespace Database\Factories;

use App\Models\Workshop;
use Illuminate\Database\Eloquent\Factories\Factory;

class TrackFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workshop_id' => Workshop::factory()->sessionBased(),
            'title' => $this->faker->words(3, true),
            'description' => $this->faker->sentence(),
            'sort_order' => $this->faker->numberBetween(0, 10),
        ];
    }

    public function forWorkshop(int $workshopId): static
    {
        return $this->state(['workshop_id' => $workshopId]);
    }
}

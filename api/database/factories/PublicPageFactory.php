<?php

namespace Database\Factories;

use App\Models\Workshop;
use Illuminate\Database\Eloquent\Factories\Factory;

class PublicPageFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workshop_id' => Workshop::factory(),
            'hero_title' => $this->faker->sentence(4),
            'hero_subtitle' => $this->faker->sentence(8),
            'body_content' => '<p>'.$this->faker->paragraph().'</p>',
            'is_visible' => false,
        ];
    }

    public function visible(): static
    {
        return $this->state(['is_visible' => true]);
    }
}

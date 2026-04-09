<?php

namespace Database\Factories;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class WorkshopFactory extends Factory
{
    public function definition(): array
    {
        $startDate = $this->faker->dateTimeBetween('+1 month', '+3 months');
        $endDate = (clone $startDate)->modify('+3 days');

        return [
            'organization_id' => Organization::factory(),
            'workshop_type' => $this->faker->randomElement(['session_based', 'event_based']),
            'title' => $this->faker->sentence(4),
            'description' => $this->faker->paragraph(),
            'status' => 'draft',
            'timezone' => 'America/New_York',
            'start_date' => $startDate->format('Y-m-d'),
            'end_date' => $endDate->format('Y-m-d'),
            'join_code' => $this->randomJoinCode(),
            'default_location_id' => null,
            'public_page_enabled' => false,
            'public_slug' => null,
        ];
    }

    public function draft(): static
    {
        return $this->state(['status' => 'draft']);
    }

    public function published(): static
    {
        return $this->state([
            'status' => 'published',
            'public_page_enabled' => true,
            'public_slug' => Str::slug($this->faker->sentence(3)),
        ]);
    }

    public function archived(): static
    {
        return $this->state(['status' => 'archived']);
    }

    public function sessionBased(): static
    {
        return $this->state(['workshop_type' => 'session_based']);
    }

    public function eventBased(): static
    {
        return $this->state(['workshop_type' => 'event_based']);
    }

    public function forOrganization(int $organizationId): static
    {
        return $this->state(['organization_id' => $organizationId]);
    }

    private function randomJoinCode(): string
    {
        $charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $length = strlen($charset);
        $code = '';

        for ($i = 0; $i < 8; $i++) {
            $code .= $charset[random_int(0, $length - 1)];
        }

        return $code;
    }
}

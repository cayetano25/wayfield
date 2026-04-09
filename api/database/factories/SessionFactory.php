<?php

namespace Database\Factories;

use App\Models\Workshop;
use Illuminate\Database\Eloquent\Factories\Factory;

class SessionFactory extends Factory
{
    public function definition(): array
    {
        $startAt = $this->faker->dateTimeBetween('+1 month', '+3 months');
        $endAt   = (clone $startAt)->modify('+2 hours');

        return [
            'workshop_id'                  => Workshop::factory(),
            'track_id'                     => null,
            'title'                        => $this->faker->sentence(4),
            'description'                  => $this->faker->paragraph(),
            'start_at'                     => $startAt->format('Y-m-d H:i:s'),
            'end_at'                       => $endAt->format('Y-m-d H:i:s'),
            'location_id'                  => null,
            'location_type'                => null,
            'location_notes'               => null,
            'capacity'                     => null,
            'delivery_type'                => 'in_person',
            'virtual_participation_allowed' => false,
            'meeting_platform'             => null,
            'meeting_url'                  => null,
            'meeting_instructions'         => null,
            'meeting_id'                   => null,
            'meeting_passcode'             => null,
            'notes'                        => null,
            'is_published'                 => false,
        ];
    }

    public function forWorkshop(int $workshopId): static
    {
        return $this->state(['workshop_id' => $workshopId]);
    }

    public function published(): static
    {
        return $this->state(['is_published' => true]);
    }

    public function withCapacity(int $capacity): static
    {
        return $this->state(['capacity' => $capacity]);
    }

    public function virtual(): static
    {
        return $this->state([
            'delivery_type' => 'virtual',
            'meeting_url'   => 'https://meet.example.com/test-session',
        ]);
    }

    public function virtualWithoutUrl(): static
    {
        return $this->state([
            'delivery_type' => 'virtual',
            'meeting_url'   => null,
        ]);
    }

    public function hybrid(): static
    {
        return $this->state([
            'delivery_type'                => 'hybrid',
            'virtual_participation_allowed' => true,
            'meeting_url'                  => 'https://meet.example.com/hybrid-session',
        ]);
    }

    public function hybridWithoutVirtualParticipation(): static
    {
        return $this->state([
            'delivery_type'                => 'hybrid',
            'virtual_participation_allowed' => false,
            'meeting_url'                  => null,
        ]);
    }
}

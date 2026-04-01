<?php

namespace Database\Factories;

use App\Models\Leader;
use App\Models\Workshop;
use Illuminate\Database\Eloquent\Factories\Factory;

class WorkshopLeaderFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workshop_id'   => Workshop::factory(),
            'leader_id'     => Leader::factory(),
            'invitation_id' => null,
            'is_confirmed'  => false,
        ];
    }

    public function confirmed(): static
    {
        return $this->state(['is_confirmed' => true]);
    }
}

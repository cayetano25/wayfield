<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\Workshop;
use Illuminate\Database\Eloquent\Factories\Factory;

class RegistrationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workshop_id' => Workshop::factory()->published(),
            'user_id' => User::factory(),
            'registration_status' => 'registered',
            'joined_via_code' => null,
            'registered_at' => now(),
            'canceled_at' => null,
        ];
    }

    public function canceled(): static
    {
        return $this->state([
            'registration_status' => 'canceled',
            'canceled_at' => now(),
        ]);
    }

    public function forWorkshop(int $workshopId): static
    {
        return $this->state(['workshop_id' => $workshopId]);
    }

    public function forUser(int $userId): static
    {
        return $this->state(['user_id' => $userId]);
    }
}

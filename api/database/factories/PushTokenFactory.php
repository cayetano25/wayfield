<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class PushTokenFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'platform' => $this->faker->randomElement(['ios', 'android']),
            'push_token' => 'ExponentPushToken['.$this->faker->unique()->regexify('[A-Za-z0-9]{20}').']',
            'is_active' => true,
            'last_registered_at' => now(),
        ];
    }

    public function forUser(int $userId): static
    {
        return $this->state(['user_id' => $userId]);
    }

    public function inactive(): static
    {
        return $this->state(['is_active' => false]);
    }

    public function ios(): static
    {
        return $this->state(['platform' => 'ios']);
    }

    public function android(): static
    {
        return $this->state(['platform' => 'android']);
    }
}

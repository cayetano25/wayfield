<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class NotificationPreferenceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'email_enabled' => true,
            'push_enabled' => true,
            'workshop_updates_enabled' => true,
            'reminder_enabled' => true,
            'marketing_enabled' => false,
        ];
    }

    public function forUser(int $userId): static
    {
        return $this->state(['user_id' => $userId]);
    }

    public function emailDisabled(): static
    {
        return $this->state(['email_enabled' => false]);
    }

    public function pushDisabled(): static
    {
        return $this->state(['push_enabled' => false]);
    }

    public function workshopUpdatesDisabled(): static
    {
        return $this->state(['workshop_updates_enabled' => false]);
    }

    public function reminderDisabled(): static
    {
        return $this->state(['reminder_enabled' => false]);
    }
}

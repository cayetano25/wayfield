<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Database\Eloquent\Factories\Factory;

class NotificationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'organization_id'    => Organization::factory(),
            'workshop_id'        => Workshop::factory(),
            'created_by_user_id' => User::factory(),
            'title'              => $this->faker->sentence(4),
            'message'            => $this->faker->paragraph(),
            'notification_type'  => 'informational',
            'sender_scope'       => 'organizer',
            'delivery_scope'     => 'all_participants',
            'session_id'         => null,
            'sent_at'            => now(),
        ];
    }

    public function forWorkshop(int $workshopId, int $organizationId, int $createdByUserId): static
    {
        return $this->state([
            'workshop_id'        => $workshopId,
            'organization_id'    => $organizationId,
            'created_by_user_id' => $createdByUserId,
        ]);
    }

    public function leader(): static
    {
        return $this->state(['sender_scope' => 'leader', 'delivery_scope' => 'session_participants']);
    }

    public function unsent(): static
    {
        return $this->state(['sent_at' => null]);
    }
}

<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class LeaderInvitationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'workshop_id' => null,
            'leader_id' => null,
            'invited_email' => $this->faker->safeEmail(),
            'invited_first_name' => $this->faker->firstName(),
            'invited_last_name' => $this->faker->lastName(),
            'status' => 'pending',
            'invitation_token_hash' => hash('sha256', Str::random(40)),
            'expires_at' => now()->addDays(7),
            'responded_at' => null,
            'created_by_user_id' => User::factory(),
        ];
    }

    public function forOrganization(int $organizationId): static
    {
        return $this->state(['organization_id' => $organizationId]);
    }

    public function forWorkshop(int $workshopId): static
    {
        return $this->state(['workshop_id' => $workshopId]);
    }

    public function accepted(): static
    {
        return $this->state([
            'status' => 'accepted',
            'responded_at' => now(),
        ]);
    }

    public function declined(): static
    {
        return $this->state([
            'status' => 'declined',
            'responded_at' => now(),
        ]);
    }

    public function expired(): static
    {
        return $this->state([
            'status' => 'expired',
            'expires_at' => now()->subDay(),
        ]);
    }

    public function expiredTime(): static
    {
        return $this->state([
            'expires_at' => now()->subDay(),
        ]);
    }
}

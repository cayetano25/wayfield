<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class OrganizationInvitationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'organization_id'    => Organization::factory(),
            'invited_email'      => $this->faker->unique()->safeEmail(),
            'invited_first_name' => $this->faker->firstName(),
            'invited_last_name'  => $this->faker->lastName(),
            'role'               => $this->faker->randomElement(['admin', 'staff', 'billing_admin']),
            'status'             => 'pending',
            'invitation_token_hash' => hash('sha256', Str::random(64)),
            'expires_at'         => now()->addDays(7),
            'responded_at'       => null,
            'created_by_user_id' => User::factory(),
        ];
    }

    public function forOrganization(int $organizationId): static
    {
        return $this->state(['organization_id' => $organizationId]);
    }

    public function withRole(string $role): static
    {
        return $this->state(['role' => $role]);
    }

    public function accepted(): static
    {
        return $this->state([
            'status'       => 'accepted',
            'responded_at' => now(),
        ]);
    }

    public function declined(): static
    {
        return $this->state([
            'status'       => 'declined',
            'responded_at' => now(),
        ]);
    }

    public function expired(): static
    {
        return $this->state([
            'expires_at' => now()->subDay(),
            'status'     => 'pending',
        ]);
    }
}

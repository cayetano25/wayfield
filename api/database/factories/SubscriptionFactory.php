<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\Subscription;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Subscription>
 */
class SubscriptionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'plan_code' => 'foundation',
            'status' => 'active',
            'starts_at' => now()->subMonth(),
            'ends_at' => null,
        ];
    }

    public function foundation(): static
    {
        return $this->state(['plan_code' => 'foundation']);
    }

    public function creator(): static
    {
        return $this->state(['plan_code' => 'creator']);
    }

    public function studio(): static
    {
        return $this->state(['plan_code' => 'studio']);
    }

    public function enterprise(): static
    {
        return $this->state(['plan_code' => 'enterprise']);
    }

    public function active(): static
    {
        return $this->state(['status' => 'active']);
    }

    public function trialing(): static
    {
        return $this->state(['status' => 'trialing']);
    }

    public function canceled(): static
    {
        return $this->state(['status' => 'canceled', 'ends_at' => now()->subDay()]);
    }

    public function forOrganization(int $organizationId): static
    {
        return $this->state(['organization_id' => $organizationId]);
    }
}

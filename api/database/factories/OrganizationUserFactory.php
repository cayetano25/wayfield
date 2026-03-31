<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrganizationUser>
 */
class OrganizationUserFactory extends Factory
{
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'user_id'         => User::factory(),
            'role'            => fake()->randomElement(['owner', 'admin', 'staff', 'billing_admin']),
            'is_active'       => true,
        ];
    }

    public function owner(): static
    {
        return $this->state(fn () => ['role' => 'owner']);
    }

    public function admin(): static
    {
        return $this->state(fn () => ['role' => 'admin']);
    }

    public function staff(): static
    {
        return $this->state(fn () => ['role' => 'staff']);
    }
}

<?php

namespace Database\Factories;

use App\Models\Leader;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

class OrganizationLeaderFactory extends Factory
{
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'leader_id'       => Leader::factory(),
            'status'          => 'active',
        ];
    }

    public function inactive(): static
    {
        return $this->state(['status' => 'inactive']);
    }
}

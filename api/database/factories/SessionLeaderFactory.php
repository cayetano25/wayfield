<?php

namespace Database\Factories;

use App\Models\Leader;
use App\Models\Session;
use Illuminate\Database\Eloquent\Factories\Factory;

class SessionLeaderFactory extends Factory
{
    public function definition(): array
    {
        return [
            'session_id' => Session::factory(),
            'leader_id' => Leader::factory(),
            'role_label' => null,
        ];
    }

    public function withRole(string $roleLabel): static
    {
        return $this->state(['role_label' => $roleLabel]);
    }
}

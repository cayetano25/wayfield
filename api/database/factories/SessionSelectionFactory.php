<?php

namespace Database\Factories;

use App\Models\Registration;
use App\Models\Session;
use Illuminate\Database\Eloquent\Factories\Factory;

class SessionSelectionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'registration_id' => Registration::factory(),
            'session_id' => Session::factory()->published(),
            'selection_status' => 'selected',
        ];
    }

    public function canceled(): static
    {
        return $this->state(['selection_status' => 'canceled']);
    }

    public function selfSelected(): static
    {
        return $this->state([
            'selection_status' => 'selected',
            'assignment_source' => 'self_selected',
            'assigned_by_user_id' => null,
            'assigned_at' => null,
        ]);
    }

    public function organizerAssigned(int $assignedByUserId): static
    {
        return $this->state([
            'selection_status' => 'selected',
            'assignment_source' => 'organizer_assigned',
            'assigned_by_user_id' => $assignedByUserId,
            'assigned_at' => now(),
        ]);
    }
}

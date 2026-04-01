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
            'registration_id'  => Registration::factory(),
            'session_id'       => Session::factory()->published(),
            'selection_status' => 'selected',
        ];
    }

    public function canceled(): static
    {
        return $this->state(['selection_status' => 'canceled']);
    }
}

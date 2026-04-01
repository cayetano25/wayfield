<?php

namespace Database\Factories;

use App\Models\Session;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class AttendanceRecordFactory extends Factory
{
    public function definition(): array
    {
        return [
            'session_id'            => Session::factory(),
            'user_id'               => User::factory(),
            'status'                => 'not_checked_in',
            'check_in_method'       => null,
            'checked_in_at'         => null,
            'checked_in_by_user_id' => null,
        ];
    }

    public function checkedIn(): static
    {
        return $this->state([
            'status'          => 'checked_in',
            'check_in_method' => 'self',
            'checked_in_at'   => now(),
        ]);
    }

    public function checkedInByLeader(int $leaderUserId): static
    {
        return $this->state([
            'status'                => 'checked_in',
            'check_in_method'       => 'leader',
            'checked_in_at'         => now(),
            'checked_in_by_user_id' => $leaderUserId,
        ]);
    }

    public function noShow(): static
    {
        return $this->state([
            'status'          => 'no_show',
            'check_in_method' => 'leader',
        ]);
    }

    public function forSession(int $sessionId): static
    {
        return $this->state(['session_id' => $sessionId]);
    }

    public function forUser(int $userId): static
    {
        return $this->state(['user_id' => $userId]);
    }
}

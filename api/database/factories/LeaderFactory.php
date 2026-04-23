<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class LeaderFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => null,
            'first_name' => $this->faker->firstName(),
            'last_name' => $this->faker->lastName(),
            'display_name' => null,
            'bio' => $this->faker->paragraph(),
            'profile_image_url' => null,
            'website_url' => $this->faker->optional()->url(),
            'email' => $this->faker->optional()->safeEmail(),
            'phone_number' => null,
            'address_line_1' => null,
            'address_line_2' => null,
            'city' => $this->faker->city(),
            'state_or_region' => $this->faker->stateAbbr(),
            'postal_code' => null,
            'country' => null,
        ];
    }

    public function withUser(int $userId): static
    {
        return $this->state(['user_id' => $userId]);
    }

    /**
     * Link the leader to an existing user account, syncing name and email from
     * that account so the leader profile mirrors the user's identity fields.
     */
    public function linkedToUser(User $user): static
    {
        return $this->state([
            'user_id'    => $user->id,
            'first_name' => $user->first_name,
            'last_name'  => $user->last_name,
            'email'      => $user->email,
        ]);
    }

    public function linkedToNewUser(): static
    {
        return $this->state(fn () => [
            'user_id' => User::factory(),
        ]);
    }

    public function placeholder(): static
    {
        return $this->state([
            'bio' => null,
            'website_url' => null,
            'phone_number' => null,
            'city' => null,
            'state_or_region' => null,
        ]);
    }
}

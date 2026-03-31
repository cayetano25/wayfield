<?php

namespace Database\Factories;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Organization>
 */
class OrganizationFactory extends Factory
{
    public function definition(): array
    {
        $name = fake()->company();

        return [
            'name'                       => $name,
            'slug'                       => Str::slug($name) . '-' . fake()->unique()->numerify('###'),
            'primary_contact_first_name' => fake()->firstName(),
            'primary_contact_last_name'  => fake()->lastName(),
            'primary_contact_email'      => fake()->unique()->safeEmail(),
            'primary_contact_phone'      => fake()->optional()->phoneNumber(),
            'status'                     => 'active',
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => ['status' => 'inactive']);
    }
}

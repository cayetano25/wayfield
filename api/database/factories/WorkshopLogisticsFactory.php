<?php

namespace Database\Factories;

use App\Models\Workshop;
use Illuminate\Database\Eloquent\Factories\Factory;

class WorkshopLogisticsFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workshop_id'          => Workshop::factory(),
            'hotel_name'           => $this->faker->company() . ' Hotel',
            'hotel_address'        => $this->faker->address(),
            'hotel_phone'          => $this->faker->phoneNumber(),
            'hotel_notes'          => $this->faker->sentence(),
            'parking_details'      => $this->faker->sentence(),
            'meeting_room_details' => $this->faker->sentence(),
            'meetup_instructions'  => $this->faker->paragraph(),
        ];
    }
}

<?php

namespace Database\Factories;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class NotificationRecipientFactory extends Factory
{
    public function definition(): array
    {
        return [
            'notification_id' => Notification::factory(),
            'user_id'         => User::factory(),
            'email_status'    => 'pending',
            'push_status'     => 'pending',
            'in_app_status'   => 'pending',
            'read_at'         => null,
        ];
    }

    public function delivered(): static
    {
        return $this->state([
            'email_status'  => 'sent',
            'push_status'   => 'sent',
            'in_app_status' => 'delivered',
        ]);
    }

    public function read(): static
    {
        return $this->state([
            'in_app_status' => 'read',
            'read_at'       => now(),
        ]);
    }
}

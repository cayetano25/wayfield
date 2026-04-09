<?php

namespace Database\Seeders;

use App\Domain\Organizations\Actions\CreateOrganizationAction;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Notification;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Suppress notifications during seeding.
        Notification::fake();

        $this->call(PlatformConfigSeeder::class);

        $user = User::factory()->create([
            'first_name' => 'Seed',
            'last_name' => 'User',
            'email' => 'seed@wayfield.dev',
        ]);

        app(CreateOrganizationAction::class)->execute($user, [
            'name' => 'Demo Organization',
            'primary_contact_first_name' => 'Seed',
            'primary_contact_last_name' => 'User',
            'primary_contact_email' => 'seed@wayfield.dev',
        ]);
    }
}

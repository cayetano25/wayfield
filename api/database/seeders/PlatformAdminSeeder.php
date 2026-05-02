<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\AdminUser;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class PlatformAdminSeeder extends Seeder
{
    public function run(): void
    {
        if (AdminUser::where('role', 'super_admin')->where('is_active', true)->exists()) {
            $this->command->info('Active super_admin already exists — skipping.');
            return;
        }

        $email    = (string) env('PLATFORM_ADMIN_EMAIL', 'admin@wayfieldapp.com');
        $password = (string) env('PLATFORM_ADMIN_PASSWORD', 'changeme-immediately');

        AdminUser::create([
            'first_name'    => 'Platform',
            'last_name'     => 'Admin',
            'email'         => $email,
            'password_hash' => Hash::make($password),
            'role'          => 'super_admin',
            'is_active'     => true,
        ]);

        $this->command->warn("Super admin created: {$email}");
        $this->command->warn('Change PLATFORM_ADMIN_PASSWORD immediately. Never commit credentials.');
    }
}

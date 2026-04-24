<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PaymentFeatureFlagSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        // Global kill switch — off at launch. Turn on explicitly per-environment.
        DB::table('payment_feature_flags')->updateOrInsert(
            ['scope' => 'platform', 'organization_id' => null, 'flag_key' => 'payments_enabled'],
            [
                'is_enabled'          => false,
                'enabled_at'          => null,
                'enabled_by_user_id'  => null,
                'notes'               => 'Global payment kill switch. Must be enabled before any org can accept payments.',
                'created_at'          => $now,
                'updated_at'          => $now,
            ],
        );
    }
}

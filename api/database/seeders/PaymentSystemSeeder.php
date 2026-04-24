<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class PaymentSystemSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(PlatformTakeRateSeeder::class);
        $this->call(RefundPolicySeeder::class);
        $this->call(PaymentFeatureFlagSeeder::class);
    }
}

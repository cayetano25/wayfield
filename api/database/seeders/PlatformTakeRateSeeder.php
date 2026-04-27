<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PlatformTakeRateSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $rates = [
            'foundation' => ['take_rate_pct' => 0.0650, 'notes' => 'Default rate for free/foundation plan organisations.'],
            'creator'    => ['take_rate_pct' => 0.0400, 'notes' => 'Reduced rate for Creator plan organisations.'],
            'studio'     => ['take_rate_pct' => 0.0200, 'notes' => 'Reduced rate for Studio plan organisations.'],
            'custom'     => ['take_rate_pct' => 0.0200, 'notes' => 'Starting point for negotiated Enterprise contracts.'],
        ];

        foreach ($rates as $planCode => $data) {
            DB::table('platform_take_rates')->updateOrInsert(
                ['plan_code' => $planCode],
                [
                    'take_rate_pct' => $data['take_rate_pct'],
                    'is_active'     => true,
                    'notes'         => $data['notes'],
                    'created_at'    => $now,
                    'updated_at'    => $now,
                ],
            );
        }
    }
}

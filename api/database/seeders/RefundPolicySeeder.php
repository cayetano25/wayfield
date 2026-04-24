<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RefundPolicySeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        DB::table('refund_policies')->updateOrInsert(
            ['scope' => 'platform', 'organization_id' => null, 'workshop_id' => null],
            [
                'full_refund_cutoff_days'    => 14,
                'partial_refund_cutoff_days' => 7,
                'partial_refund_pct'         => 50.00,
                'no_refund_cutoff_hours'     => 48,
                'wayfield_fee_refundable'    => false,
                'stripe_fee_refundable'      => false,
                'allow_credits'              => false,
                'credit_expiry_days'         => 365,
                'custom_policy_text'         => 'Full refunds are available up to 14 days before the workshop start date. Partial refunds (50%) are available 7–14 days before. No refunds within 48 hours of the start time.',
                'created_at'                 => $now,
                'updated_at'                 => $now,
            ],
        );
    }
}

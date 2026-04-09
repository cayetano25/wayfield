<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PlatformConfigSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $entries = [
            [
                'config_key' => 'platform_admin_session_timeout_hours',
                'config_value' => '8',
                'value_type' => 'integer',
                'description' => 'Number of hours before a platform admin session token expires.',
                'is_sensitive' => false,
            ],
            [
                'config_key' => 'automation_evaluation_interval_minutes',
                'config_value' => '5',
                'value_type' => 'integer',
                'description' => 'How often (in minutes) the automation evaluation job runs.',
                'is_sensitive' => false,
            ],
            [
                'config_key' => 'security_brute_force_threshold',
                'config_value' => '10',
                'value_type' => 'integer',
                'description' => 'Number of failed platform admin login attempts from the same IP before a security_event is raised.',
                'is_sensitive' => false,
            ],
            [
                'config_key' => 'stripe_webhook_secret',
                'config_value' => '',
                'value_type' => 'string',
                'description' => 'Stripe webhook signing secret. Set via environment or this config — never hardcode.',
                'is_sensitive' => true,
            ],
            [
                'config_key' => 'crisp_website_id',
                'config_value' => '',
                'value_type' => 'string',
                'description' => 'Crisp website ID for the support integration.',
                'is_sensitive' => false,
            ],
            [
                'config_key' => 'crisp_webhook_secret',
                'config_value' => '',
                'value_type' => 'string',
                'description' => 'Crisp webhook signing secret for validating inbound events.',
                'is_sensitive' => true,
            ],
        ];

        foreach ($entries as $entry) {
            DB::table('platform_config')->updateOrInsert(
                ['config_key' => $entry['config_key']],
                array_merge($entry, [
                    'updated_by_admin_id' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])
            );
        }
    }
}

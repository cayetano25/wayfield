<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // MODIFY COLUMN is MySQL-only; SQLite (used in tests) has no real enum
        // enforcement so the TEXT column already accepts any value.
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE scheduled_payment_jobs MODIFY COLUMN job_type
            ENUM(
                'balance_charge',
                'balance_reminder',
                'commitment_date_reminder',
                'commitment_date_passed',
                'waitlist_window_expiry',
                'waitlist_window_reminder',
                'pre_workshop_7day',
                'pre_workshop_24hour',
                'pre_session_1hour',
                'dispute_evidence_reminder',
                'stripe_onboarding_incomplete_reminder',
                'cart_expiry',
                'minimum_attendance_check',
                'payment_requires_action_reminder'
            ) NOT NULL");
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("ALTER TABLE scheduled_payment_jobs MODIFY COLUMN job_type
            ENUM(
                'balance_charge',
                'balance_reminder',
                'commitment_date_reminder',
                'commitment_date_passed',
                'waitlist_window_expiry',
                'waitlist_window_reminder',
                'pre_workshop_7day',
                'pre_workshop_24hour',
                'pre_session_1hour',
                'dispute_evidence_reminder',
                'stripe_onboarding_incomplete_reminder',
                'cart_expiry',
                'minimum_attendance_check'
            ) NOT NULL");
    }
};

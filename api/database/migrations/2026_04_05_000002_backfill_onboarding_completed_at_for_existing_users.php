<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Backfill onboarding_completed_at for users who registered before the
 * onboarding wizard was introduced (Phase 10).
 *
 * Any user whose onboarding_completed_at is still NULL is treated as
 * already onboarded — they should never see the wizard.  We set the
 * value to their created_at timestamp so the data looks natural.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->whereNull('onboarding_completed_at')
            ->update(['onboarding_completed_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        // Intentionally a no-op: we cannot distinguish rows that were
        // backfilled from rows genuinely completed later.
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    public function up(): void
    {
        try {
            // Backfill sessions that have a location_id but no location_type yet.
            // Idempotent — the WHERE location_type IS NULL guard prevents double-updates.
            DB::statement('
                UPDATE sessions
                SET location_type = \'address\'
                WHERE location_id IS NOT NULL
                  AND location_type IS NULL
            ');
        } catch (Throwable $e) {
            Log::error('set_location_type_for_existing_sessions backfill failed', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function down(): void
    {
        // Not reversible — we do not know which rows were previously null.
    }
};

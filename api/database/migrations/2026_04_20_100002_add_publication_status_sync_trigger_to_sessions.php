<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * BEFORE UPDATE trigger that keeps is_published in sync with publication_status.
     *
     * publication_status is the source of truth going forward.
     * is_published is preserved as a compatibility column until all callers
     * migrate to publication_status; this trigger ensures it never drifts.
     *
     * Trigger creation is skipped on SQLite (used by the test suite) because:
     *   - SQLite does not support the SET NEW.col = ... syntax in BEFORE triggers
     *   - The sync invariant is enforced in application code during the transition
     *   - No test exercises the trigger directly
     *
     * DB::unprepared() is required for multi-statement trigger bodies; PDO's
     * prepared-statement mode cannot execute BEGIN…END blocks.
     */
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::unprepared("
            CREATE TRIGGER sessions_sync_is_published
            BEFORE UPDATE ON sessions
            FOR EACH ROW
            BEGIN
                IF NEW.publication_status = 'published' THEN
                    SET NEW.is_published = 1;
                ELSE
                    SET NEW.is_published = 0;
                END IF;
            END
        ");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::unprepared('DROP TRIGGER IF EXISTS sessions_sync_is_published');
    }
};

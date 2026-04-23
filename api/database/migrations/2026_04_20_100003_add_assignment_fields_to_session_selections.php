<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Extends session_selections with organizer-assignment tracking fields.
     *
     * assignment_source uses the same three-step safe pattern established in
     * alter_login_events_add_outcome: nullable add → backfill → change() NOT NULL.
     */
    public function up(): void
    {
        // ── Step 1a: add columns as nullable ─────────────────────────────────
        Schema::table('session_selections', function (Blueprint $table) {
            $table->enum('assignment_source', [
                'self_selected', 'organizer_assigned', 'invite_accepted', 'waitlist_promoted', 'addon_purchase',
            ])->nullable()->after('selection_status');

            $table->unsignedBigInteger('assigned_by_user_id')->nullable()->after('assignment_source');
            $table->dateTime('assigned_at')->nullable()->after('assigned_by_user_id');
            $table->text('assignment_notes')->nullable()->after('assigned_at');

            $table->foreign('assigned_by_user_id', 'fk_session_selections_assigned_by')
                ->references('id')
                ->on('users')
                ->onDelete('set null');
        });

        // ── Step 1b: backfill existing rows ──────────────────────────────────
        DB::statement("
            UPDATE session_selections
            SET assignment_source = 'self_selected'
            WHERE assignment_source IS NULL
        ");

        // ── Step 1c: change() to NOT NULL ─────────────────────────────────────
        Schema::table('session_selections', function (Blueprint $table) {
            $table->enum('assignment_source', [
                'self_selected', 'organizer_assigned', 'invite_accepted', 'waitlist_promoted', 'addon_purchase',
            ])->default('self_selected')->nullable(false)->change();
        });

        // ── Indexes ───────────────────────────────────────────────────────────
        Schema::table('session_selections', function (Blueprint $table) {
            $table->index('assignment_source', 'idx_session_selections_assignment_source');
            $table->index('assigned_by_user_id', 'idx_session_selections_assigned_by');
        });
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            // On MySQL: FK must be dropped before its backing index.
            // Use information_schema guards so this is idempotent if a previous
            // partial rollback already removed some of these objects
            // (MySQL DDL is non-transactional and cannot be rolled back).
            $this->dropForeignKeyIfExists('session_selections', 'fk_session_selections_assigned_by');
            $this->dropIndexIfExists('session_selections', 'idx_session_selections_assignment_source');
            $this->dropIndexIfExists('session_selections', 'idx_session_selections_assigned_by');
        }

        // On SQLite, Laravel's dropColumn() recreates the table; FKs and indexes
        // are implicitly removed. No explicit drop needed.
        Schema::table('session_selections', function (Blueprint $table) {
            $table->dropColumn([
                'assignment_source',
                'assigned_by_user_id',
                'assigned_at',
                'assignment_notes',
            ]);
        });
    }

    private function dropForeignKeyIfExists(string $table, string $constraint): void
    {
        $exists = DB::selectOne("
            SELECT CONSTRAINT_NAME
            FROM information_schema.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA  = DATABASE()
              AND TABLE_NAME    = ?
              AND CONSTRAINT_TYPE = 'FOREIGN KEY'
              AND CONSTRAINT_NAME = ?
        ", [$table, $constraint]);

        if ($exists) {
            DB::statement("ALTER TABLE `{$table}` DROP FOREIGN KEY `{$constraint}`");
        }
    }

    private function dropIndexIfExists(string $table, string $index): void
    {
        $exists = DB::selectOne("
            SELECT INDEX_NAME
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = ?
              AND INDEX_NAME   = ?
        ", [$table, $index]);

        if ($exists) {
            DB::statement("ALTER TABLE `{$table}` DROP INDEX `{$index}`");
        }
    }
};

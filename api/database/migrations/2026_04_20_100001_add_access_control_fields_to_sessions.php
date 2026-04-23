<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Three-step safe migration for NOT NULL ENUM columns on a live table,
     * following the project pattern established in alter_login_events_add_outcome:
     *
     *   Step 1a — add columns as nullable (no lock on existing rows)
     *   Step 1b — backfill every existing row (no NULLs survive)
     *   Step 1c — change() to NOT NULL with correct defaults
     */
    public function up(): void
    {
        // ── Step 1a: add all new columns as nullable ─────────────────────────
        Schema::table('sessions', function (Blueprint $table) {
            $table->enum('session_type', ['standard', 'addon', 'private', 'vip', 'makeup_session'])
                ->nullable()
                ->after('is_published');

            $table->enum('publication_status', ['draft', 'published', 'archived', 'cancelled'])
                ->nullable()
                ->after('session_type');

            $table->enum('participant_visibility', ['visible', 'hidden', 'invite_only'])
                ->nullable()
                ->after('publication_status');

            $table->enum('enrollment_mode', ['self_select', 'organizer_assign_only', 'invite_accept', 'purchase_required'])
                ->nullable()
                ->after('participant_visibility');

            $table->boolean('requires_separate_entitlement')->nullable()->after('enrollment_mode');
            $table->dateTime('selection_opens_at')->nullable()->after('requires_separate_entitlement');
            $table->dateTime('selection_closes_at')->nullable()->after('selection_opens_at');
        });

        // ── Step 1b: backfill existing rows ──────────────────────────────────
        // publication_status derives from is_published so they stay in sync
        // until the trigger (migration 2) takes over for future writes.
        DB::statement("
            UPDATE sessions
            SET
                session_type                  = 'standard',
                publication_status            = CASE WHEN is_published = 1 THEN 'published' ELSE 'draft' END,
                participant_visibility         = 'visible',
                enrollment_mode               = 'self_select',
                requires_separate_entitlement = 0
            WHERE session_type IS NULL
        ");

        // ── Step 1c: change() to NOT NULL with defaults ───────────────────────
        Schema::table('sessions', function (Blueprint $table) {
            $table->enum('session_type', ['standard', 'addon', 'private', 'vip', 'makeup_session'])
                ->default('standard')->nullable(false)->change();

            $table->enum('publication_status', ['draft', 'published', 'archived', 'cancelled'])
                ->default('draft')->nullable(false)->change();

            $table->enum('participant_visibility', ['visible', 'hidden', 'invite_only'])
                ->default('visible')->nullable(false)->change();

            $table->enum('enrollment_mode', ['self_select', 'organizer_assign_only', 'invite_accept', 'purchase_required'])
                ->default('self_select')->nullable(false)->change();

            $table->boolean('requires_separate_entitlement')->default(false)->nullable(false)->change();
        });

        // ── Indexes ───────────────────────────────────────────────────────────
        Schema::table('sessions', function (Blueprint $table) {
            $table->index('session_type', 'idx_sessions_session_type');
            $table->index('publication_status', 'idx_sessions_publication_status');
            $table->index('participant_visibility', 'idx_sessions_participant_visibility');
            $table->index('enrollment_mode', 'idx_sessions_enrollment_mode');
        });
    }

    public function down(): void
    {
        Schema::table('sessions', function (Blueprint $table) {
            $table->dropIndex('idx_sessions_session_type');
            $table->dropIndex('idx_sessions_publication_status');
            $table->dropIndex('idx_sessions_participant_visibility');
            $table->dropIndex('idx_sessions_enrollment_mode');

            $table->dropColumn([
                'session_type',
                'publication_status',
                'participant_visibility',
                'enrollment_mode',
                'requires_separate_entitlement',
                'selection_opens_at',
                'selection_closes_at',
            ]);
        });
    }
};

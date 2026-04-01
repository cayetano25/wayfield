<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Multi-leader session model migration.
 *
 * Adds:
 * - role_in_session: structured enum role (replaces the freeform role_label in semantics)
 * - assignment_status: pending/accepted/declined/removed
 * - is_primary: marks the primary/lead instructor for the session
 *
 * Backward compatibility:
 * - existing rows default to assignment_status='accepted' (preserves Phase 4 behavior)
 * - existing rows default to is_primary=false
 * - role_label is retained for human-readable display overrides
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('session_leaders', function (Blueprint $table) {
            $table->enum('role_in_session', [
                'primary_leader',
                'co_leader',
                'panelist',
                'moderator',
                'assistant',
            ])->default('co_leader')->after('role_label');

            $table->enum('assignment_status', [
                'pending',
                'accepted',
                'declined',
                'removed',
            ])->default('accepted')->after('role_in_session');

            $table->boolean('is_primary')->default(false)->after('assignment_status');

            $table->index('assignment_status');
        });

        // Promote existing confirmed primary assignments where is_primary should be inferred.
        // Since the old model had no primary concept, we leave all as false — organizers
        // can designate a primary leader via the new API.
    }

    public function down(): void
    {
        Schema::table('session_leaders', function (Blueprint $table) {
            $table->dropIndex(['assignment_status']);
            $table->dropColumn(['role_in_session', 'assignment_status', 'is_primary']);
        });
    }
};

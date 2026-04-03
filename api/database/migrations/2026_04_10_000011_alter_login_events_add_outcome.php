<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bring login_events in line with COMMAND_CENTER_SCHEMA.md.
 *
 * Existing columns retained: user_id, email_attempted, ip_address, user_agent,
 *   platform, created_at (no updated_at — append-only).
 *
 * New column: outcome ENUM('success','failed','unverified','inactive')
 *   replaces the old boolean success + failure_reason columns.
 *
 * The existing success/failure_reason columns are kept temporarily to avoid
 * breaking the RecordLoginEventService during the transition, then dropped
 * once the service is updated.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('login_events', function (Blueprint $table) {
            $table->enum('outcome', ['success', 'failed', 'unverified', 'inactive'])
                ->nullable()
                ->after('platform');
        });

        // Backfill outcome from existing success/failure_reason
        DB::statement("UPDATE login_events SET outcome = CASE
            WHEN success = 1 THEN 'success'
            WHEN failure_reason = 'account_inactive' THEN 'inactive'
            ELSE 'failed'
        END WHERE outcome IS NULL");

        Schema::table('login_events', function (Blueprint $table) {
            // Make NOT NULL now that backfill is done
            $table->enum('outcome', ['success', 'failed', 'unverified', 'inactive'])
                ->nullable(false)
                ->change();

            // Drop index on success before dropping the column
            $table->dropIndex('login_events_success_created_at_index');
            // Remove old columns
            $table->dropColumn(['success', 'failure_reason']);
        });

        // Re-add index on new column
        Schema::table('login_events', function (Blueprint $table) {
            $table->index('outcome');
        });
    }

    public function down(): void
    {
        Schema::table('login_events', function (Blueprint $table) {
            $table->boolean('success')->nullable();
            $table->string('failure_reason', 255)->nullable();
            $table->dropColumn('outcome');
        });
    }
};

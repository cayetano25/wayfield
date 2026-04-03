<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bring security_events in line with COMMAND_CENTER_SCHEMA.md.
 *
 * Existing columns retained: id, user_id, organization_id, event_type,
 *   ip_address, metadata_json, created_at.
 *
 * New columns: description, is_resolved, resolved_at, resolved_by_admin_id.
 *
 * Severity ENUM: old was ('info','warning','critical'),
 *   new is ('low','medium','high','critical').
 *   Mapped: info→low, warning→medium, critical→critical.
 *
 * Dropped: user_agent (not in spec).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('security_events', function (Blueprint $table) {
            // Add description (required in new spec)
            $table->text('description')->nullable()->after('event_type');

            // Add resolution tracking
            $table->boolean('is_resolved')->default(false)->after('metadata_json');
            $table->dateTime('resolved_at')->nullable()->after('is_resolved');
            $table->foreignId('resolved_by_admin_id')
                ->nullable()
                ->constrained('admin_users')
                ->nullOnDelete()
                ->after('resolved_at');

            // Add new severity column alongside old one
            $table->enum('new_severity', ['low', 'medium', 'high', 'critical'])
                ->nullable()
                ->after('resolved_by_admin_id');
        });

        // Backfill description
        DB::statement("UPDATE security_events SET description = CONCAT(event_type, ' detected') WHERE description IS NULL");

        // Map old severity → new severity
        DB::statement("UPDATE security_events SET new_severity = CASE
            WHEN severity = 'info'     THEN 'low'
            WHEN severity = 'warning'  THEN 'medium'
            WHEN severity = 'critical' THEN 'critical'
            ELSE 'low'
        END WHERE new_severity IS NULL");

        Schema::table('security_events', function (Blueprint $table) {
            $table->text('description')->nullable(false)->change();
            $table->enum('new_severity', ['low', 'medium', 'high', 'critical'])->nullable(false)->change();

            // Drop indexes that reference columns being removed
            $table->dropIndex('security_events_severity_created_at_index');
            $table->dropIndex('security_events_event_type_created_at_index');
            // Drop old columns
            $table->dropColumn(['severity', 'user_agent']);
        });

        // Re-add the event_type index (column still exists, just renaming index)
        Schema::table('security_events', function (Blueprint $table) {
            $table->index(['event_type', 'created_at']);
        });

        // Rename new_severity → severity
        Schema::table('security_events', function (Blueprint $table) {
            $table->renameColumn('new_severity', 'severity');
        });

        Schema::table('security_events', function (Blueprint $table) {
            $table->index(['is_resolved', 'severity']);
        });
    }

    public function down(): void
    {
        Schema::table('security_events', function (Blueprint $table) {
            $table->dropForeign(['resolved_by_admin_id']);
            $table->dropIndex(['is_resolved', 'severity']);

            $table->enum('old_severity', ['info', 'warning', 'critical'])->nullable()->after('metadata_json');
            $table->string('user_agent', 500)->nullable();

            $table->dropColumn(['description', 'is_resolved', 'resolved_at', 'resolved_by_admin_id', 'severity']);
        });

        Schema::table('security_events', function (Blueprint $table) {
            $table->renameColumn('old_severity', 'severity');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bring automation_rules in line with COMMAND_CENTER_SCHEMA.md.
 *
 * Existing columns retained:
 *   - organization_id, name, conditions_json, is_active, last_run_at (→ last_evaluated_at)
 *
 * Renamed (ADD + backfill + DROP approach for MySQL 5.7 compat):
 *   - trigger_event → trigger_type
 *   - actions_json  → action_type + action_config_json
 *
 * New columns added:
 *   - description, action_type, action_config_json, scope,
 *     run_interval_minutes, last_evaluated_at, created_by_admin_id
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('automation_rules', function (Blueprint $table) {
            // Rename trigger_event → trigger_type
            $table->string('trigger_type', 100)->nullable()->after('name');

            // Add description
            $table->text('description')->nullable()->after('trigger_type');

            // Add split action columns (replaces actions_json)
            $table->string('action_type', 100)->nullable()->after('conditions_json');
            $table->json('action_config_json')->nullable()->after('action_type');

            // Add scope
            $table->enum('scope', ['platform', 'organization'])->default('platform')->after('is_active');

            // Add scheduling fields
            $table->unsignedInteger('run_interval_minutes')->default(60)->after('scope');
            $table->dateTime('last_evaluated_at')->nullable()->after('run_interval_minutes');

            // Add creator reference (nullable initially so existing rows don't fail)
            $table->foreignId('created_by_admin_id')
                ->nullable()
                ->constrained('admin_users')
                ->nullOnDelete()
                ->after('last_evaluated_at');
        });

        // Backfill trigger_type from trigger_event for existing rows
        DB::statement('UPDATE automation_rules SET trigger_type = trigger_event WHERE trigger_type IS NULL');

        // Backfill last_evaluated_at from last_run_at
        DB::statement('UPDATE automation_rules SET last_evaluated_at = last_run_at WHERE last_evaluated_at IS NULL AND last_run_at IS NOT NULL');

        // Backfill action_config_json from actions_json
        DB::statement('UPDATE automation_rules SET action_config_json = actions_json WHERE action_config_json IS NULL AND actions_json IS NOT NULL');

        Schema::table('automation_rules', function (Blueprint $table) {
            // Make trigger_type NOT NULL now that backfill is done
            $table->string('trigger_type', 100)->nullable(false)->change();

            // Drop old columns
            $table->dropIndex(['trigger_event', 'is_active']);
            $table->dropColumn(['trigger_event', 'actions_json', 'last_run_at']);
        });

        // Re-add index with new column name
        Schema::table('automation_rules', function (Blueprint $table) {
            $table->index(['trigger_type', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::table('automation_rules', function (Blueprint $table) {
            $table->dropForeign(['created_by_admin_id']);
            $table->dropIndex(['trigger_type', 'is_active']);

            $table->string('trigger_event', 100)->nullable()->after('name');
            $table->json('actions_json')->nullable()->after('conditions_json');
            $table->dateTime('last_run_at')->nullable();

            $table->dropColumn([
                'trigger_type', 'description', 'action_type', 'action_config_json',
                'scope', 'run_interval_minutes', 'last_evaluated_at', 'created_by_admin_id',
            ]);
        });

        Schema::table('automation_rules', function (Blueprint $table) {
            $table->index(['trigger_event', 'is_active']);
        });
    }
};

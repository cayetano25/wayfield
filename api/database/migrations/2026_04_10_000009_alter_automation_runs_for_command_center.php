<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Bring automation_runs in line with COMMAND_CENTER_SCHEMA.md.
 *
 * Old schema used: rule_id (FK), triggered_by (string), status (broad enum),
 *   started_at, finished_at, input_json, output_json, error_message, timestamps
 *
 * New schema per spec: automation_rule_id, triggered_at (datetime),
 *   entity_type, entity_id, outcome (3-value enum), actions_taken_count,
 *   metadata_json, error_message — created_at only (no updated_at, append-only)
 */
return new class extends Migration
{
    public function up(): void
    {
        // Step 1 — Add new nullable columns first
        Schema::table('automation_runs', function (Blueprint $table) {
            $table->string('entity_type', 100)->nullable()->after('rule_id');
            $table->unsignedBigInteger('entity_id')->nullable()->after('entity_type');
            $table->enum('outcome', ['success', 'failed', 'skipped'])->nullable()->after('entity_id');
            $table->unsignedInteger('actions_taken_count')->default(0)->after('outcome');
            $table->json('metadata_json')->nullable()->after('actions_taken_count');
            $table->dateTime('triggered_at')->nullable()->after('metadata_json');
        });

        // Step 2 — Backfill new columns
        DB::statement("UPDATE automation_runs SET outcome = CASE
            WHEN status = 'completed' THEN 'success'
            WHEN status = 'skipped'   THEN 'skipped'
            ELSE 'failed'
        END WHERE outcome IS NULL");

        DB::statement('UPDATE automation_runs SET triggered_at = COALESCE(started_at, created_at) WHERE triggered_at IS NULL');

        // Step 3 — Make backfilled columns NOT NULL
        Schema::table('automation_runs', function (Blueprint $table) {
            $table->enum('outcome', ['success', 'failed', 'skipped'])->nullable(false)->change();
            $table->dateTime('triggered_at')->nullable(false)->change();
        });

        // Step 4 — Drop the FK constraint so the index can be removed
        Schema::table('automation_runs', function (Blueprint $table) {
            $table->dropForeign(['rule_id']);
        });

        // Step 5 — Drop old indexes and columns
        Schema::table('automation_runs', function (Blueprint $table) {
            $table->dropIndex('automation_runs_rule_id_status_index');
            // started_at has its own index that must be dropped before the column
            $table->dropIndex('automation_runs_started_at_index');
            $table->dropColumn(['triggered_by', 'status', 'started_at', 'finished_at', 'input_json', 'output_json']);
        });

        // Step 6 — Rename rule_id → automation_rule_id
        Schema::table('automation_runs', function (Blueprint $table) {
            $table->renameColumn('rule_id', 'automation_rule_id');
        });

        // Step 7 — Re-add FK on renamed column; drop updated_at
        Schema::table('automation_runs', function (Blueprint $table) {
            $table->foreign('automation_rule_id')
                ->references('id')
                ->on('automation_rules')
                ->cascadeOnDelete();

            $table->dropColumn('updated_at');
        });

        // Step 8 — Add new indexes
        Schema::table('automation_runs', function (Blueprint $table) {
            $table->index(['automation_rule_id', 'triggered_at']);
            $table->index('outcome');
        });
    }

    public function down(): void
    {
        Schema::table('automation_runs', function (Blueprint $table) {
            $table->dropForeign(['automation_rule_id']);
            $table->dropIndex(['automation_rule_id', 'triggered_at']);
            $table->dropIndex(['outcome']);
        });

        Schema::table('automation_runs', function (Blueprint $table) {
            $table->renameColumn('automation_rule_id', 'rule_id');
        });

        Schema::table('automation_runs', function (Blueprint $table) {
            $table->string('triggered_by', 100)->nullable();
            $table->enum('status', ['pending', 'running', 'completed', 'failed', 'skipped'])->default('pending');
            $table->dateTime('started_at')->nullable();
            $table->dateTime('finished_at')->nullable();
            $table->json('input_json')->nullable();
            $table->json('output_json')->nullable();
            $table->dateTime('updated_at')->nullable();

            $table->dropColumn(['entity_type', 'entity_id', 'outcome', 'actions_taken_count', 'metadata_json', 'triggered_at']);
        });

        Schema::table('automation_runs', function (Blueprint $table) {
            $table->foreign('rule_id')->references('id')->on('automation_rules')->cascadeOnDelete();
            $table->index(['rule_id', 'status']);
        });
    }
};

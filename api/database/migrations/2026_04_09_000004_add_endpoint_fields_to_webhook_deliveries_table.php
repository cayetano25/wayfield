<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The webhook_deliveries table was created in an earlier phase with a flat
     * structure (organization_id + webhook_url). Phase 9 introduces webhook_endpoints
     * as a first-class entity, so we add webhook_endpoint_id and next_retry_at here.
     * The original columns remain to avoid breaking any existing data or queries.
     */
    public function up(): void
    {
        Schema::table('webhook_deliveries', function (Blueprint $table) {
            $table->foreignId('webhook_endpoint_id')
                ->nullable()
                ->after('id')
                ->constrained('webhook_endpoints')
                ->nullOnDelete();

            $table->dateTime('next_retry_at')->nullable()->after('delivered_at');

            $table->index(['webhook_endpoint_id', 'created_at']);
            $table->index('next_retry_at');
            $table->index('event_type');
        });
    }

    public function down(): void
    {
        Schema::table('webhook_deliveries', function (Blueprint $table) {
            $table->dropForeign(['webhook_endpoint_id']);
            $table->dropIndex(['webhook_endpoint_id', 'created_at']);
            $table->dropIndex(['next_retry_at']);
            $table->dropIndex(['event_type']);
            $table->dropColumn(['webhook_endpoint_id', 'next_retry_at']);
        });
    }
};

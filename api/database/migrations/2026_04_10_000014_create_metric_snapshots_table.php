<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('metric_snapshots', function (Blueprint $table) {
            $table->id();
            // Examples: dau, wau, mau, check_in_rate, invite_acceptance_rate
            $table->string('metric_key', 100);
            $table->enum('granularity', ['daily', 'weekly', 'monthly']);
            $table->date('period_start');
            $table->date('period_end');
            $table->decimal('value', 15, 4);
            // Null = platform-wide metric, set = org-scoped metric
            $table->unsignedBigInteger('organization_id')->nullable();
            $table->json('metadata_json')->nullable();
            $table->dateTime('computed_at');

            $table->unique(['metric_key', 'granularity', 'period_start', 'organization_id'], 'metric_snapshots_unique');
            $table->index(['metric_key', 'period_start']);
            $table->index('organization_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metric_snapshots');
    }
};

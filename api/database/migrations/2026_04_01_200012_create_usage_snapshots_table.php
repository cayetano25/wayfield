<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('usage_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->enum('snapshot_type', ['monthly', 'daily'])->default('monthly');
            $table->date('period_start');
            $table->date('period_end');
            $table->json('metrics_json');
            $table->dateTime('created_at');

            $table->index(['organization_id', 'snapshot_type', 'period_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usage_snapshots');
    }
};

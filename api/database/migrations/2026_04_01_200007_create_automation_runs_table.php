<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automation_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rule_id')->constrained('automation_rules')->cascadeOnDelete();
            $table->string('triggered_by', 100);
            $table->enum('status', ['pending', 'running', 'completed', 'failed', 'skipped'])->default('pending');
            $table->dateTime('started_at')->nullable();
            $table->dateTime('finished_at')->nullable();
            $table->json('input_json')->nullable();
            $table->json('output_json')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['rule_id', 'status']);
            $table->index('started_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_runs');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('failed_jobs_log', function (Blueprint $table) {
            $table->id();
            $table->uuid('job_uuid')->unique();
            $table->string('queue', 100);
            $table->string('job_class', 255);
            // Nullable — not all jobs are org-scoped
            $table->unsignedBigInteger('organization_id')->nullable();
            $table->text('error_message');
            $table->dateTime('failed_at');
            $table->dateTime('retried_at')->nullable();
            $table->dateTime('resolved_at')->nullable();

            $table->index('job_class');
            $table->index('queue');
            $table->index('failed_at');
            $table->index('resolved_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('failed_jobs_log');
    }
};

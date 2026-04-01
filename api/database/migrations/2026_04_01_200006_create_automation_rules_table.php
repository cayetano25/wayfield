<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automation_rules', function (Blueprint $table) {
            $table->id();
            // NULL = platform-wide rule; set = tenant-scoped rule
            $table->foreignId('organization_id')->nullable()->constrained('organizations')->cascadeOnDelete();
            $table->string('name', 255);
            $table->string('trigger_event', 100);
            $table->json('conditions_json')->nullable();
            $table->json('actions_json');
            $table->boolean('is_active')->default(true);
            $table->dateTime('last_run_at')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'is_active']);
            $table->index(['trigger_event', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_rules');
    }
};

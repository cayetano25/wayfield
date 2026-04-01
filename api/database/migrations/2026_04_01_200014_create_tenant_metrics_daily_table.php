<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_metrics_daily', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->date('date');
            $table->unsignedInteger('active_workshops')->default(0);
            $table->unsignedInteger('total_participants')->default(0);
            $table->unsignedInteger('total_sessions')->default(0);
            $table->unsignedInteger('notifications_sent')->default(0);
            $table->timestamps();

            $table->unique(['organization_id', 'date']);
            $table->index('date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenant_metrics_daily');
    }
};

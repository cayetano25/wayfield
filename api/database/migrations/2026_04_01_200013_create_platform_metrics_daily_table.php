<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_metrics_daily', function (Blueprint $table) {
            $table->id();
            $table->date('date')->unique();
            $table->unsignedInteger('active_organizations')->default(0);
            $table->unsignedInteger('active_workshops')->default(0);
            $table->unsignedInteger('total_registrations')->default(0);
            $table->unsignedInteger('total_notifications_sent')->default(0);
            $table->unsignedInteger('new_signups')->default(0);
            $table->unsignedBigInteger('revenue_cents')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_metrics_daily');
    }
};

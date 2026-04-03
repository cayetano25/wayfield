<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_announcements', function (Blueprint $table) {
            $table->id();
            $table->string('title', 255);
            $table->text('message');
            $table->enum('announcement_type', ['info', 'warning', 'maintenance', 'outage', 'update'])
                ->default('info');
            $table->enum('severity', ['low', 'medium', 'high', 'critical'])
                ->default('low');
            $table->enum('target_audience', ['all', 'organizers'])
                ->default('all');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_dismissable')->default(true);
            $table->dateTime('starts_at');
            $table->dateTime('ends_at')->nullable();
            $table->foreignId('created_by_admin_id')
                ->constrained('platform_admins')
                ->restrictOnDelete();
            $table->timestamps();

            $table->index(['is_active', 'starts_at', 'ends_at']);
            $table->index('announcement_type');
            $table->index('created_by_admin_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_announcements');
    }
};

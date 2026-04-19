<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->enum('notification_category', ['message', 'invitation', 'system'])
                  ->default('message')
                  ->after('notification_type')
                  ->comment('Distinguishes system notifications from user messages.');

            $table->json('action_data')
                  ->nullable()
                  ->after('notification_category')
                  ->comment('Structured payload for actionable notifications.');

            $table->index('notification_category', 'idx_notifications_category');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('idx_notifications_category');
            $table->dropColumn(['notification_category', 'action_data']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('workshop_id')->constrained('workshops')->cascadeOnDelete();
            $table->foreignId('created_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 255);
            $table->text('message');
            $table->enum('notification_type', ['informational', 'urgent', 'reminder']);
            $table->enum('sender_scope', ['organizer', 'leader']);
            $table->enum('delivery_scope', ['all_participants', 'leaders', 'custom', 'session_participants']);
            $table->foreignId('session_id')->nullable()->constrained('sessions')->nullOnDelete();
            $table->dateTime('sent_at')->nullable();
            $table->timestamps();

            $table->index(['organization_id', 'workshop_id']);
            $table->index('session_id');
            $table->index(['sender_scope', 'sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};

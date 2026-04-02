<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offline_action_queue', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('workshop_id')->nullable()->constrained('workshops')->nullOnDelete();
            $table->enum('action_type', ['self_check_in', 'leader_check_in', 'attendance_override']);
            $table->char('client_action_uuid', 36);
            $table->json('payload_json');
            $table->dateTime('processed_at')->nullable();
            $table->dateTime('created_at');
            $table->dateTime('updated_at');

            $table->unique('client_action_uuid');
            $table->index(['user_id', 'processed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offline_action_queue');
    }
};

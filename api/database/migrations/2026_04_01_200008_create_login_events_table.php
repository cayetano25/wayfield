<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('login_events', function (Blueprint $table) {
            $table->id();
            // Nullable so we can record attempts for non-existent accounts
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('email_attempted', 255);
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->enum('platform', ['web', 'ios', 'android', 'unknown'])->default('unknown');
            $table->boolean('success');
            $table->string('failure_reason', 255)->nullable();
            // Immutable record — no updated_at
            $table->dateTime('created_at');

            $table->index(['user_id', 'created_at']);
            $table->index(['email_attempted', 'created_at']);
            $table->index(['success', 'created_at']);
            $table->index('ip_address');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_events');
    }
};

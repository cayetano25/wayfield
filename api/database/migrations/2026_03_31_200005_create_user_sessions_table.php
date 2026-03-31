<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->index('user_id');
            $table->string('session_token_hash', 255);
            $table->enum('platform', ['web', 'ios', 'android', 'unknown'])->default('unknown');
            $table->string('device_name', 255)->nullable();
            $table->dateTime('last_seen_at')->nullable();
            $table->dateTime('expires_at')->nullable()->index();
            $table->dateTime('created_at');
            $table->dateTime('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_sessions');
    }
};

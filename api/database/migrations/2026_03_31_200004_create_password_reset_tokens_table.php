<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email', 255)->primary();
            $table->string('token_hash', 255);
            $table->dateTime('expires_at');
            $table->dateTime('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_tokens');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_2fa_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('method_type', ['totp', 'email_code']);
            $table->text('secret_encrypted')->nullable();
            $table->boolean('is_enabled')->default(false);
            $table->dateTime('last_used_at')->nullable();
            $table->dateTime('created_at');
            $table->dateTime('updated_at');

            $table->index(['user_id', 'is_enabled']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_2fa_methods');
    }
};

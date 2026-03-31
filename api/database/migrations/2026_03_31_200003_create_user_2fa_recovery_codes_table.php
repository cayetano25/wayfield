<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_2fa_recovery_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->index('user_id');
            $table->string('code_hash', 255);
            $table->dateTime('used_at')->nullable();
            $table->index('used_at');
            $table->dateTime('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_2fa_recovery_codes');
    }
};

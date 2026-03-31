<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('auth_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->index('user_id');
            $table->enum('provider', ['email', 'google', 'facebook']);
            $table->string('provider_user_id', 255)->nullable();
            $table->string('provider_email', 255)->nullable();
            $table->dateTime('created_at');
            $table->dateTime('updated_at');

            $table->unique(['provider', 'provider_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auth_methods');
    }
};

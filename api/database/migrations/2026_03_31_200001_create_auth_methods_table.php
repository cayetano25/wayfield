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
            // Phase 9: 'saml' and 'oidc' added here so SQLite test databases
            // include them in the CHECK constraint from the start.
            // On MySQL production, the separate alter migration handles the column change.
            $table->enum('provider', ['email', 'google', 'facebook', 'saml', 'oidc']);
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

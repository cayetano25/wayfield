<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_users', function (Blueprint $table) {
            $table->id();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('email', 255)->unique();
            $table->string('password_hash', 255);
            $table->enum('role', ['super_admin', 'admin', 'support', 'billing', 'readonly'])
                ->default('readonly');
            $table->boolean('is_active')->default(true);
            $table->boolean('can_impersonate')->default(false);
            $table->dateTime('last_login_at')->nullable();
            $table->timestamps();

            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_users');
    }
};

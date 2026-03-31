<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organization_users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete()->index();
            $table->enum('role', ['owner', 'admin', 'staff', 'billing_admin']);
            $table->boolean('is_active')->default(true);
            $table->dateTime('created_at');
            $table->dateTime('updated_at');

            $table->unique(['organization_id', 'user_id', 'role']);
            $table->index(['organization_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_users');
    }
};

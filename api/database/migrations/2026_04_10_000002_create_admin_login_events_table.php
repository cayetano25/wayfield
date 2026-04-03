<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_login_events', function (Blueprint $table) {
            $table->id();
            // Nullable so we can record attempts for unknown email addresses
            $table->foreignId('admin_user_id')->nullable()->constrained('admin_users')->nullOnDelete();
            $table->string('email_attempted', 255);
            $table->enum('outcome', ['success', 'failed', 'locked']);
            $table->string('ip_address', 45);
            $table->string('user_agent', 500)->nullable();
            // Immutable record — no updated_at
            $table->dateTime('created_at');

            $table->index('admin_user_id');
            $table->index('ip_address');
            $table->index('outcome');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_login_events');
    }
};

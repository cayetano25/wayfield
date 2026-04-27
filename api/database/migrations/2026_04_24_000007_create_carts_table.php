<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('carts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->foreignId('organization_id')
                ->constrained('organizations')
                ->cascadeOnDelete();
            $table->enum('status', ['active', 'checked_out', 'abandoned', 'expired'])
                ->notNull()
                ->default('active');
            $table->string('stripe_account_id', 100)->nullable();
            $table->unsignedInteger('subtotal_cents')->notNull()->default(0);
            $table->char('currency', 3)->notNull()->default('usd');
            $table->dateTime('expires_at')->notNull();
            $table->dateTime('last_activity_at')->notNull();
            $table->dateTime('checked_out_at')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            // Enforces one active cart per user per org (one row per status combo).
            $table->unique(['user_id', 'organization_id', 'status'], 'carts_user_org_status_unique');
            $table->index(['user_id', 'status']);
            $table->index(['expires_at', 'status']);
            $table->index('organization_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('carts');
    }
};

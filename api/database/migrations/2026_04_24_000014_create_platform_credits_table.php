<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_credits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->unsignedInteger('amount_cents')->notNull();
            $table->char('currency', 3)->notNull()->default('usd');
            $table->enum('source_type', ['refund', 'promotion', 'manual_grant'])->notNull()->default('refund');
            $table->foreignId('source_refund_request_id')
                ->nullable()
                ->constrained('refund_requests')
                ->nullOnDelete();
            $table->boolean('is_used')->notNull()->default(false);
            $table->dateTime('expires_at')->notNull();
            $table->dateTime('used_at')->nullable();
            $table->foreignId('used_in_order_id')
                ->nullable()
                ->constrained('orders')
                ->nullOnDelete();
            $table->text('notes')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index(['user_id', 'is_used', 'expires_at']);
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_credits');
    }
};

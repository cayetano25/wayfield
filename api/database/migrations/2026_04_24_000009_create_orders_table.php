<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number', 20)->notNull()->unique();
            $table->foreignId('user_id')
                ->constrained('users');
            $table->foreignId('organization_id')
                ->constrained('organizations');
            $table->foreignId('cart_id')
                ->nullable()
                ->constrained('carts')
                ->nullOnDelete();
            $table->enum('status', [
                'pending',
                'processing',
                'completed',
                'failed',
                'partially_refunded',
                'fully_refunded',
                'cancelled',
                'disputed',
            ])->notNull()->default('pending');
            $table->enum('payment_method', ['stripe', 'free', 'credit'])->notNull()->default('stripe');
            $table->unsignedInteger('subtotal_cents')->notNull()->default(0);
            $table->unsignedInteger('wayfield_fee_cents')->notNull()->default(0);
            $table->unsignedInteger('stripe_fee_cents')->notNull()->default(0);
            $table->unsignedInteger('total_cents')->notNull()->default(0);
            $table->unsignedInteger('organizer_payout_cents')->notNull()->default(0);
            $table->char('currency', 3)->notNull()->default('usd');
            $table->decimal('take_rate_pct', 5, 4)->notNull()->default(0.0000);
            $table->string('stripe_payment_intent_id', 100)->nullable();
            $table->string('stripe_charge_id', 100)->nullable();
            $table->boolean('is_deposit_order')->notNull()->default(false);
            $table->dateTime('deposit_paid_at')->nullable();
            $table->date('balance_due_date')->nullable();
            $table->dateTime('balance_paid_at')->nullable();
            $table->string('balance_stripe_payment_intent_id', 100)->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->dateTime('cancelled_at')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->json('metadata_json')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index(['user_id', 'status']);
            $table->index(['organization_id', 'status']);
            $table->index('stripe_payment_intent_id');
            $table->index('status');
            $table->index(['balance_due_date', 'status']);
            $table->index(['is_deposit_order', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};

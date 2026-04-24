<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_intents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')
                ->constrained('orders')
                ->cascadeOnDelete();
            $table->enum('intent_type', ['full', 'deposit', 'balance'])->notNull()->default('full');
            $table->string('stripe_payment_intent_id', 100)->notNull()->unique();
            $table->string('stripe_account_id', 100)->notNull();
            $table->unsignedInteger('amount_cents')->notNull();
            $table->char('currency', 3)->notNull()->default('usd');
            $table->unsignedInteger('application_fee_cents')->notNull()->default(0);
            $table->enum('status', [
                'requires_payment_method',
                'requires_confirmation',
                'requires_action',
                'processing',
                'requires_capture',
                'cancelled',
                'succeeded',
                'failed',
            ])->notNull();
            $table->string('stripe_status', 50)->nullable();
            // Hashed client secret — never store plaintext (per spec).
            $table->string('client_secret_hash', 255)->nullable();
            $table->text('last_payment_error')->nullable();
            $table->dateTime('confirmed_at')->nullable();
            $table->dateTime('cancelled_at')->nullable();
            $table->json('metadata_json')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index(['order_id', 'intent_type']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_intents');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refund_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('refund_request_id')
                ->constrained('refund_requests');
            $table->foreignId('order_id')
                ->constrained('orders');
            $table->string('stripe_refund_id', 100)->notNull()->unique();
            $table->string('stripe_charge_id', 100)->notNull();
            $table->string('stripe_account_id', 100)->notNull();
            $table->unsignedInteger('amount_cents')->notNull();
            $table->char('currency', 3)->notNull()->default('usd');
            $table->enum('status', ['pending', 'succeeded', 'failed', 'cancelled'])->notNull();
            $table->text('failure_reason')->nullable();
            $table->dateTime('stripe_created_at')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index('refund_request_id');
            $table->index('order_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refund_transactions');
    }
};

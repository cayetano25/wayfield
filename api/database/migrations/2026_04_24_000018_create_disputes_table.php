<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('disputes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')
                ->constrained('orders');
            $table->string('stripe_dispute_id', 100)->notNull()->unique();
            $table->string('stripe_charge_id', 100)->notNull();
            $table->string('stripe_account_id', 100)->notNull();
            $table->unsignedInteger('amount_cents')->notNull();
            $table->char('currency', 3)->notNull()->default('usd');
            $table->string('reason', 100)->notNull();
            $table->enum('status', [
                'warning_needs_response',
                'warning_under_review',
                'warning_closed',
                'needs_response',
                'under_review',
                'charge_refunded',
                'won',
                'lost',
            ])->notNull();
            $table->dateTime('evidence_due_by')->nullable();
            $table->dateTime('evidence_submitted_at')->nullable();
            $table->boolean('is_charge_refundable')->notNull()->default(true);
            $table->string('network_reason_code', 50)->nullable();
            $table->dateTime('evidence_deadline_reminder_sent_at')->nullable();
            $table->dateTime('resolved_at')->nullable();
            $table->enum('resolution', ['won', 'lost', 'withdrawn'])->nullable();
            $table->json('stripe_metadata_json')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index('order_id');
            $table->index('status');
            $table->index(['evidence_due_by', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('disputes');
    }
};

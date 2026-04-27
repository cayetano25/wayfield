<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refund_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')
                ->constrained('orders');
            $table->foreignId('order_item_id')
                ->nullable()
                ->constrained('order_items');
            $table->foreignId('requested_by_user_id')
                ->constrained('users');
            $table->enum('reason_code', [
                'cancellation',
                'schedule_conflict',
                'dissatisfied',
                'medical',
                'organizer_cancelled',
                'other',
            ])->notNull();
            $table->text('reason_text')->nullable();
            $table->unsignedInteger('requested_amount_cents')->notNull();
            $table->unsignedInteger('approved_amount_cents')->nullable();
            $table->enum('status', [
                'pending',
                'auto_approved',
                'organizer_approved',
                'organizer_denied',
                'processed',
                'failed',
            ])->notNull()->default('pending');
            $table->boolean('auto_eligible')->notNull()->default(false);
            $table->enum('policy_applied_scope', ['platform', 'organization', 'workshop'])->nullable();
            $table->foreignId('reviewed_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->dateTime('reviewed_at')->nullable();
            $table->text('review_notes')->nullable();
            $table->string('stripe_refund_id', 100)->nullable();
            $table->dateTime('processed_at')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index('order_id');
            $table->index('requested_by_user_id');
            $table->index('status');
            $table->index(['auto_eligible', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refund_requests');
    }
};

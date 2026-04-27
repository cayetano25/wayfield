<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('waitlist_promotion_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')
                ->constrained('users');
            $table->foreignId('workshop_id')
                ->constrained('workshops');
            $table->foreignId('waitlist_entry_id')
                ->nullable()
                ->constrained('registrations')
                ->nullOnDelete();
            $table->unsignedInteger('promotion_order')->notNull()->default(1);
            $table->enum('status', ['window_open', 'payment_completed', 'window_expired', 'skipped'])
                ->notNull()
                ->default('window_open');
            $table->unsignedInteger('payment_window_hours')->notNull()->default(48);
            $table->dateTime('window_opened_at')->notNull();
            $table->dateTime('window_expires_at')->notNull();
            $table->dateTime('reminder_sent_at')->nullable();
            $table->dateTime('payment_completed_at')->nullable();
            $table->foreignId('order_id')
                ->nullable()
                ->constrained('orders')
                ->nullOnDelete();
            $table->dateTime('skipped_at')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index(['user_id', 'workshop_id']);
            $table->index(['status', 'window_expires_at']);
            $table->index(['workshop_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('waitlist_promotion_payments');
    }
};

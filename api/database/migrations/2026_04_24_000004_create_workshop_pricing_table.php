<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workshop_pricing', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workshop_id')
                ->unique()
                ->constrained('workshops')
                ->cascadeOnDelete();
            $table->unsignedInteger('base_price_cents')->notNull()->default(0);
            $table->char('currency', 3)->notNull()->default('usd');
            $table->boolean('is_paid')->notNull()->default(false);
            $table->boolean('deposit_enabled')->notNull()->default(false);
            $table->unsignedInteger('deposit_amount_cents')->nullable();
            $table->boolean('deposit_is_nonrefundable')->notNull()->default(true);
            $table->date('balance_due_date')->nullable();
            $table->boolean('balance_auto_charge')->notNull()->default(true);
            $table->json('balance_reminder_days')->nullable();
            $table->unsignedInteger('minimum_attendance')->nullable();
            $table->date('commitment_date')->nullable();
            $table->string('commitment_description', 500)->nullable();
            $table->json('commitment_reminder_days')->nullable();
            $table->decimal('post_commitment_refund_pct', 5, 2)->nullable()->default(0.00);
            $table->text('post_commitment_refund_note')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index('is_paid');
            $table->index('deposit_enabled');
            $table->index('balance_due_date');
            $table->index('commitment_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workshop_pricing');
    }
};

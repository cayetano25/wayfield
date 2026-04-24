<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')
                ->constrained('orders')
                ->cascadeOnDelete();
            $table->enum('item_type', ['workshop_registration', 'addon_session', 'waitlist_upgrade'])->notNull();
            $table->foreignId('workshop_id')
                ->nullable()
                ->constrained('workshops')
                ->nullOnDelete();
            $table->foreignId('session_id')
                ->nullable()
                ->constrained('sessions')
                ->nullOnDelete();
            $table->foreignId('registration_id')
                ->nullable()
                ->constrained('registrations')
                ->nullOnDelete();
            $table->foreignId('session_selection_id')
                ->nullable()
                ->constrained('session_selections')
                ->nullOnDelete();
            $table->unsignedInteger('unit_price_cents')->notNull()->default(0);
            $table->unsignedInteger('quantity')->notNull()->default(1);
            $table->unsignedInteger('line_total_cents')->notNull()->default(0);
            $table->boolean('is_deposit')->notNull()->default(false);
            $table->unsignedInteger('refunded_amount_cents')->notNull()->default(0);
            $table->enum('refund_status', ['none', 'partial', 'full'])->notNull()->default('none');
            $table->char('currency', 3)->notNull()->default('usd');
            $table->json('metadata_json')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index('order_id');
            $table->index('workshop_id');
            $table->index('session_id');
            $table->index('registration_id');
            $table->index('refund_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};

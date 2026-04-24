<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cart_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cart_id')
                ->constrained('carts')
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
            $table->unsignedInteger('unit_price_cents')->notNull()->default(0);
            $table->unsignedInteger('quantity')->notNull()->default(1);
            $table->unsignedInteger('line_total_cents')->notNull()->default(0);
            $table->boolean('is_deposit')->notNull()->default(false);
            $table->unsignedInteger('deposit_amount_cents')->nullable();
            $table->unsignedInteger('balance_amount_cents')->nullable();
            $table->date('balance_due_date')->nullable();
            $table->char('currency', 3)->notNull()->default('usd');
            $table->json('metadata_json')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index('cart_id');
            $table->index('workshop_id');
            $table->index('session_id');
            $table->index('item_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cart_items');
    }
};

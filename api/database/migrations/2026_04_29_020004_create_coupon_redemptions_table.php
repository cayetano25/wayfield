<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('coupon_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('coupon_id')
                ->constrained('coupons');
            $table->foreignId('order_id')
                ->constrained('orders')
                ->cascadeOnDelete();
            $table->foreignId('user_id')
                ->constrained('users');
            $table->foreignId('organization_id')
                ->constrained('organizations');
            $table->foreignId('workshop_id')
                ->nullable()
                ->constrained('workshops')
                ->nullOnDelete();
            $table->unsignedInteger('discount_amount_cents')->notNull();
            $table->unsignedInteger('pre_discount_subtotal_cents')->notNull();
            $table->unsignedInteger('post_discount_total_cents')->notNull();
            // Snapshot in case the coupon code or type is later edited.
            $table->string('coupon_code_snapshot', 50)->notNull();
            $table->enum('discount_type_snapshot', ['percentage', 'fixed_amount', 'free'])->notNull();
            $table->dateTime('created_at')->notNull();

            // One redemption per order per coupon.
            $table->unique(['coupon_id', 'order_id'], 'redemptions_coupon_order_unique');
            // coupon_id and order_id are already indexed by their FK constraints.
            $table->index('user_id');
            $table->index(['organization_id', 'created_at'], 'redemptions_org_created_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coupon_redemptions');
    }
};

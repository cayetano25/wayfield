<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedBigInteger('coupon_id')->nullable()->after('cart_id');
            $table->string('coupon_code', 50)->nullable()->after('coupon_id');
            $table->unsignedInteger('discount_cents')->notNull()->default(0)->after('coupon_code');

            $table->foreign('coupon_id', 'orders_coupon_fk')
                ->references('id')
                ->on('coupons')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign('orders_coupon_fk');
            $table->dropColumn(['coupon_id', 'coupon_code', 'discount_cents']);
        });
    }
};

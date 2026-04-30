<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('carts', function (Blueprint $table) {
            $table->unsignedBigInteger('applied_coupon_id')->nullable()->after('currency');
            $table->string('coupon_code_applied', 50)->nullable()->after('applied_coupon_id');
            $table->unsignedInteger('discount_cents')->notNull()->default(0)->after('coupon_code_applied');
            // discounted_total_cents = subtotal_cents - discount_cents
            $table->unsignedInteger('discounted_total_cents')->notNull()->default(0)->after('discount_cents');

            $table->foreign('applied_coupon_id', 'carts_applied_coupon_fk')
                ->references('id')
                ->on('coupons')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('carts', function (Blueprint $table) {
            $table->dropForeign('carts_applied_coupon_fk');
            $table->dropColumn([
                'applied_coupon_id',
                'coupon_code_applied',
                'discount_cents',
                'discounted_total_cents',
            ]);
        });
    }
};

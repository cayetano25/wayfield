<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cart_items', function (Blueprint $table) {
            $table->unsignedBigInteger('applied_tier_id')->nullable()->after('unit_price_cents');
            $table->string('applied_tier_label', 100)->nullable()->after('applied_tier_id');
            $table->boolean('is_tier_price')->notNull()->default(false)->after('applied_tier_label');

            $table->foreign('applied_tier_id', 'cart_items_applied_tier_fk')
                ->references('id')
                ->on('workshop_price_tiers')
                ->nullOnDelete();

            $table->index('applied_tier_id', 'idx_cart_items_tier');
        });
    }

    public function down(): void
    {
        Schema::table('cart_items', function (Blueprint $table) {
            $table->dropForeign('cart_items_applied_tier_fk');
            $table->dropIndex('idx_cart_items_tier');
            $table->dropColumn(['applied_tier_id', 'applied_tier_label', 'is_tier_price']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            // stripe_subscription_id and its index already exist in the schema
            $table->string('stripe_price_id', 255)->nullable();
            $table->string('stripe_status', 50)->nullable();
            $table->string('billing_interval', 20)->nullable()
                ->comment('monthly or annual');
            $table->dateTime('trial_ends_at')->nullable();
            $table->dateTime('current_period_start')->nullable();
            $table->dateTime('canceled_at')->nullable();
            $table->boolean('cancel_at_period_end')->default(false);
            $table->string('default_payment_method_id', 255)->nullable();
            $table->string('card_brand', 50)->nullable();
            $table->string('card_last_four', 4)->nullable();
            $table->string('card_exp_month', 2)->nullable();
            $table->string('card_exp_year', 4)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn([
                'stripe_price_id',
                'stripe_status',
                'billing_interval',
                'trial_ends_at',
                'current_period_start',
                'canceled_at',
                'cancel_at_period_end',
                'default_payment_method_id',
                'card_brand',
                'card_last_four',
                'card_exp_month',
                'card_exp_year',
            ]);
        });
    }
};

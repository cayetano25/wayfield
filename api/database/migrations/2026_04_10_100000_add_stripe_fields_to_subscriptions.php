<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->string('stripe_customer_id')->nullable()->after('organization_id')
                ->comment('Stripe Customer ID');
            $table->string('stripe_subscription_id')->nullable()->after('stripe_customer_id')
                ->comment('Stripe Subscription ID');
            $table->enum('billing_cycle', ['monthly', 'annual'])->nullable()->default(null)
                ->after('stripe_subscription_id');
            $table->dateTime('current_period_end')->nullable()->default(null)
                ->after('billing_cycle');

            $table->index('stripe_customer_id');
            $table->index('stripe_subscription_id');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropIndex(['stripe_customer_id']);
            $table->dropIndex(['stripe_subscription_id']);
            $table->dropColumn([
                'stripe_customer_id',
                'stripe_subscription_id',
                'billing_cycle',
                'current_period_end',
            ]);
        });
    }
};

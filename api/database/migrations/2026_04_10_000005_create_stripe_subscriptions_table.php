<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stripe_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('stripe_customer_id', 255);
            $table->string('stripe_subscription_id', 255)->unique();
            $table->string('stripe_price_id', 255);
            $table->enum('plan_code', ['foundation', 'creator', 'studio', 'enterprise']);
            $table->enum('status', [
                'active', 'trialing', 'past_due', 'canceled',
                'incomplete', 'incomplete_expired', 'unpaid', 'paused',
            ]);
            $table->dateTime('trial_ends_at')->nullable();
            $table->dateTime('current_period_start');
            $table->dateTime('current_period_end');
            $table->dateTime('canceled_at')->nullable();
            $table->dateTime('ended_at')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();

            $table->index('organization_id');
            $table->index('status');
            $table->index('plan_code');
            $table->index('current_period_end');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stripe_subscriptions');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stripe_connect_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')
                ->unique()
                ->constrained('organizations')
                ->cascadeOnDelete();
            $table->string('stripe_account_id', 100)->notNull()->unique();
            $table->enum('onboarding_status', ['initiated', 'pending', 'complete', 'restricted', 'deauthorized'])
                ->notNull()
                ->default('initiated');
            $table->boolean('charges_enabled')->notNull()->default(false);
            $table->boolean('payouts_enabled')->notNull()->default(false);
            $table->boolean('details_submitted')->notNull()->default(false);
            $table->char('country', 2)->notNull()->default('US');
            $table->char('default_currency', 3)->notNull()->default('usd');
            $table->dateTime('onboarding_completed_at')->nullable();
            $table->dateTime('deauthorized_at')->nullable();
            $table->dateTime('last_webhook_received_at')->nullable();
            $table->json('capabilities_json')->nullable();
            $table->json('requirements_json')->nullable();
            $table->dateTime('created_at')->notNull();
            $table->dateTime('updated_at')->notNull();

            $table->index('onboarding_status');
            $table->index('charges_enabled');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stripe_connect_accounts');
    }
};

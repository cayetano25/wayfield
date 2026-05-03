<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->cascadeOnDelete();
            $table->enum('plan_code', ['foundation', 'creator', 'studio', 'enterprise']);
            $table->enum('status', ['active', 'trialing', 'past_due', 'canceled', 'expired']);
            $table->dateTime('starts_at');
            $table->dateTime('ends_at')->nullable();
            $table->dateTime('created_at');
            $table->dateTime('updated_at');

            $table->index(['organization_id', 'status']);
            $table->index('plan_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('webhook_endpoints', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')
                ->constrained('organizations')
                ->cascadeOnDelete();

            // The target URL to receive POST requests
            $table->string('url', 1000)->notNull();

            // The raw signing secret is never stored.
            // The secret is encrypted via Laravel encrypt() so it can be retrieved
            // for HMAC signing when delivering events. Named secret_encrypted.
            $table->text('secret_encrypted')->notNull();

            $table->string('description', 255)->nullable();
            $table->boolean('is_active')->default(true)->notNull();

            // Array of subscribed event type strings.
            // Example: ["workshop.published","participant.registered"]
            $table->json('event_types')->notNull();

            // Tracks consecutive delivery failures for circuit-breaker logic
            $table->unsignedInteger('failure_count')->default(0)->notNull();
            $table->dateTime('last_success_at')->nullable();
            $table->dateTime('last_failure_at')->nullable();

            $table->dateTime('created_at');
            $table->dateTime('updated_at');

            $table->index(['organization_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_endpoints');
    }
};

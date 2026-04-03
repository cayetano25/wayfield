<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stripe_events', function (Blueprint $table) {
            $table->id();
            $table->string('stripe_event_id', 255)->unique();
            $table->string('event_type', 100);
            $table->boolean('livemode')->default(false);
            $table->json('payload_json');
            $table->dateTime('processed_at')->nullable();
            $table->text('error_message')->nullable();
            // Immutable record — no updated_at
            $table->dateTime('created_at');

            $table->index('event_type');
            $table->index('processed_at');
            $table->index('livemode');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stripe_events');
    }
};

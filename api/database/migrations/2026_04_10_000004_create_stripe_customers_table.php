<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stripe_customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->unique()->constrained('organizations')->cascadeOnDelete();
            $table->string('stripe_id', 255)->unique();
            $table->string('email', 255);
            $table->string('name', 255)->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();

            $table->index('stripe_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stripe_customers');
    }
};

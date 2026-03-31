<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name')->nullable();
            $table->string('address_line_1')->nullable();
            $table->string('address_line_2')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state_or_region', 100)->nullable();
            $table->string('postal_code', 30)->nullable();
            $table->string('country', 100)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestamps();

            $table->index('organization_id');
            $table->index(['city', 'state_or_region']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('locations');
    }
};

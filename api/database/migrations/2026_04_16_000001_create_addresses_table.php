<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('addresses', function (Blueprint $table) {
            $table->id();
            $table->char('country_code', 2)->default('US')->comment('ISO 3166-1 alpha-2');
            $table->string('address_line_1', 255)->nullable();
            $table->string('address_line_2', 255)->nullable();
            $table->string('address_line_3', 255)->nullable();
            $table->string('locality', 100)->nullable();
            $table->string('administrative_area', 100)->nullable();
            $table->string('dependent_locality', 100)->nullable();
            $table->string('postal_code', 30)->nullable(); // VARCHAR always — preserves leading zeros
            $table->string('sorting_code', 30)->nullable();
            $table->text('formatted_address')->nullable()->comment('Normalized display string, maintained by system');
            $table->enum('validation_status', ['unverified', 'verified', 'failed'])->default('unverified');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestamps();

            $table->index('country_code');
            $table->index(['locality', 'administrative_area']);
            $table->index('postal_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('addresses');
    }
};

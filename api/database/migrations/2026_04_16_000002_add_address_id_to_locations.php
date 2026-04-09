<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->foreignId('address_id')
                ->nullable()
                ->after('country')
                ->constrained('addresses')
                ->nullOnDelete();

            // Transitional column — prefer address.country_code; existing country VARCHAR stays
            $table->char('country_code', 2)
                ->nullable()
                ->after('address_id')
                ->comment('ISO 3166-1 alpha-2, derived from country field — use address.country_code instead');
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->dropForeign(['address_id']);
            $table->dropColumn(['address_id', 'country_code']);
        });
    }
};

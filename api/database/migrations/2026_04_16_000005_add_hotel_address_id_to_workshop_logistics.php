<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workshop_logistics', function (Blueprint $table) {
            $table->foreignId('hotel_address_id')
                ->nullable()
                ->after('hotel_address')
                ->constrained('addresses')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('workshop_logistics', function (Blueprint $table) {
            $table->dropForeign(['hotel_address_id']);
            $table->dropColumn('hotel_address_id');
        });
    }
};

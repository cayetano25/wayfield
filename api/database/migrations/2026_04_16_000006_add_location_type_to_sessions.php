<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sessions', function (Blueprint $table) {
            $table->enum('location_type', ['hotel', 'address', 'coordinates'])
                ->nullable()
                ->default(null)
                ->comment('Null means no location set. hotel=inherit workshop hotel, address=structured address, coordinates=field lat/lng')
                ->after('location_id');

            $table->string('location_notes', 500)
                ->nullable()
                ->default(null)
                ->comment('Sub-location note e.g. Conference room B, Behind the post office')
                ->after('location_type');

            $table->index('location_type', 'idx_sessions_location_type');
        });
    }

    public function down(): void
    {
        Schema::table('sessions', function (Blueprint $table) {
            $table->dropIndex('idx_sessions_location_type');
            $table->dropColumn(['location_type', 'location_notes']);
        });
    }
};

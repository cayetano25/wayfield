<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('addresses', function (Blueprint $table) {
            // SHA-256 hash of the normalized canonical address string.
            // Used as the cache lookup key.
            // Set by AddressNormalizer before the job is dispatched.
            $table->string('geocode_hash', 64)
                ->nullable()
                ->default(null)
                ->after('validation_status')
                ->comment('SHA-256 of normalized address. Used as geocode cache key.');

            // How many geocoding attempts have been made.
            // Prevents infinite retry storms.
            $table->tinyInteger('geocode_attempts')
                ->unsigned()
                ->default(0)
                ->after('geocode_hash')
                ->comment('Number of geocoding attempts. Max set in config.');

            // Timestamp of the last successful geocode.
            $table->timestamp('last_geocoded_at')
                ->nullable()
                ->default(null)
                ->after('geocode_attempts')
                ->comment('When coordinates were last successfully obtained.');

            // Last error message from a failed geocoding attempt.
            // Cleared to null on success.
            $table->string('geocode_error', 500)
                ->nullable()
                ->default(null)
                ->after('last_geocoded_at')
                ->comment('Last geocoding failure reason. Null on success.');

            // Index for cache key lookups
            $table->index('geocode_hash', 'idx_addresses_geocode_hash');

            // Index for finding addresses that need geocoding
            $table->index(
                ['validation_status', 'geocode_attempts'],
                'idx_addresses_needs_geocoding'
            );

            // Spatial-style index for future radius search
            $table->index(
                ['latitude', 'longitude'],
                'idx_addresses_lat_lng'
            );
        });
    }

    public function down(): void
    {
        Schema::table('addresses', function (Blueprint $table) {
            $table->dropIndex('idx_addresses_geocode_hash');
            $table->dropIndex('idx_addresses_needs_geocoding');
            $table->dropIndex('idx_addresses_lat_lng');
            $table->dropColumn([
                'geocode_hash',
                'geocode_attempts',
                'last_geocoded_at',
                'geocode_error',
            ]);
        });
    }
};

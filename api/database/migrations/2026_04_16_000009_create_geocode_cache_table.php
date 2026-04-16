<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('geocode_cache', function (Blueprint $table) {
            $table->id();

            // Primary lookup key — SHA-256 of the normalized address string.
            // Must be unique: one cache entry per distinct canonical address.
            $table->string('geocode_hash', 64)->unique()
                ->comment('SHA-256 of normalized address. Primary cache key.');

            // The normalized string that was sent to Nominatim.
            // Stored for debugging — allows human review of what was submitted.
            $table->text('normalized_input')
                ->comment('The normalized address string that was geocoded.');

            // Which geocoding service produced this result.
            $table->string('provider', 50)->default('nominatim')
                ->comment('Geocoding provider: nominatim, etc.');

            // Coordinates — null for miss and failed entries.
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();

            // Provider's own formatted address string.
            $table->text('formatted_address')->nullable()
                ->comment('display_name from Nominatim response.');

            // Outcome of the geocoding attempt.
            // hit    = coordinates found successfully
            // miss   = no results returned by provider
            // failed = API error, timeout, or malformed request
            $table->enum('status', ['hit', 'miss', 'failed'])
                ->default('hit')
                ->comment('hit=found, miss=no results, failed=API error.');

            // Nominatim importance score (0.0–1.0) converted to 0–100 integer.
            // Higher = better match confidence.
            // Null for miss and failed entries.
            $table->tinyInteger('confidence')->unsigned()->nullable()
                ->comment('0-100 confidence score from provider importance field.');

            // Nominatim place_id for reference (not used programmatically).
            $table->string('provider_place_id', 255)->nullable()
                ->comment('Nominatim place_id. For reference only.');

            // Nominatim type field (e.g. house, city, administrative).
            $table->string('provider_type', 100)->nullable()
                ->comment('Nominatim type field e.g. house, city, state.');

            // For miss and failed entries — why it did not succeed.
            $table->string('failure_reason', 500)->nullable()
                ->comment('Error message or reason when status=failed or miss.');

            // Cache expiry. Null means never expires.
            // Successful hits: 90 days (GEOCODE_CACHE_TTL_DAYS).
            // Failed/miss:     24 hours (GEOCODE_FAILED_TTL_HOURS).
            $table->timestamp('expires_at')->nullable()
                ->comment('When to consider this entry stale. Null = never.');

            // When this entry was created or last refreshed.
            $table->timestamp('last_resolved_at')->useCurrent()
                ->comment('When this result was last obtained from the provider.');

            $table->timestamps();

            // Performance indexes
            $table->index('status', 'idx_geocode_cache_status');
            $table->index('expires_at', 'idx_geocode_cache_expires');
            $table->index(['latitude', 'longitude'], 'idx_geocode_cache_lat_lng');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('geocode_cache');
    }
};

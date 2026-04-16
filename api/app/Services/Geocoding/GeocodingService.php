<?php

declare(strict_types=1);

namespace App\Services\Geocoding;

use App\Models\Address;
use App\Models\GeocodeCache;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Cache-first geocoding orchestrator.
 *
 * Lookup flow:
 *   1. Normalize the address → compute geocode_hash
 *   2. Check geocode_cache table for a valid (non-expired) entry
 *   3a. Cache HIT — hydrate the address record with cached coordinates
 *   3b. Cache MISS — call NominatimClient, persist result to cache,
 *       then hydrate the address record
 *
 * This service is called FROM the GeocodeAddressJob.
 * It should not be called directly from controllers or request handlers.
 *
 * Does NOT dispatch jobs. The job calls this service.
 */
final class GeocodingService
{
    public function __construct(
        private readonly NominatimClient   $client,
        private readonly AddressNormalizer $normalizer,
    ) {}

    /**
     * Geocode an address using the cache-first strategy.
     *
     * Returns true if coordinates were obtained (from cache or API).
     * Returns false if the address could not be geocoded.
     *
     * Always updates the address record with the outcome.
     */
    public function geocode(Address $address): bool
    {
        // Guard: do not attempt if address is not geocodeable
        if (! $address->isGeocodeable()) {
            Log::info('[Geocoding] Skipped — address not geocodeable', [
                'address_id' => $address->id,
            ]);

            return false;
        }

        $normalizedString = $this->normalizer->normalize($address);
        $hash             = $this->normalizer->hash($address);

        // Persist the hash on the address record immediately
        // so the cache lookup works even if we crash partway through
        $address->updateQuietly(['geocode_hash' => $hash]);

        // ── Step 1: Check the geocode_cache table ─────────────────────
        $cached = GeocodeCache::where('geocode_hash', $hash)->first();

        if ($cached !== null && $cached->isValid()) {
            return $this->applyFromCache($address, $cached);
        }

        // ── Step 2: Call Nominatim ────────────────────────────────────
        $queryParams = $this->normalizer->toNominatimQuery($address);

        try {
            $result = $this->client->search($queryParams);

            if ($result !== null) {
                return $this->handleHit($address, $normalizedString, $hash, $result);
            } else {
                return $this->handleMiss($address, $normalizedString, $hash);
            }

        } catch (NominatimException $e) {
            return $this->handleFailure($address, $normalizedString, $hash, $e->getMessage());
        }
    }

    // ── Private helpers ───────────────────────────────────────────────

    /**
     * Apply coordinates from a valid cache entry to the address record.
     * Does not call the API.
     */
    private function applyFromCache(Address $address, GeocodeCache $cache): bool
    {
        if (! $cache->hasCoordinates()) {
            Log::info('[Geocoding] Cache hit but no coordinates (miss/failed entry)', [
                'address_id' => $address->id,
                'hash'       => $cache->geocode_hash,
                'status'     => $cache->status,
            ]);
            // Still increment attempts so we do not retry forever
            $address->increment('geocode_attempts');

            return false;
        }

        $address->updateQuietly([
            'latitude'          => $cache->latitude,
            'longitude'         => $cache->longitude,
            'formatted_address' => $cache->formatted_address ?? $address->formatted_address,
            'validation_status' => 'verified',
            'last_geocoded_at'  => now(),
            'geocode_error'     => null,
        ]);

        Log::info('[Geocoding] Applied coordinates from cache', [
            'address_id' => $address->id,
            'lat'        => $cache->latitude,
            'lng'        => $cache->longitude,
        ]);

        return true;
    }

    /**
     * Handle a successful Nominatim result.
     * Persist to geocode_cache and hydrate the address record.
     */
    private function handleHit(
        Address $address,
        string $normalizedInput,
        string $hash,
        array $result
    ): bool {
        $lat  = (float) $result['lat'];
        $lng  = (float) $result['lon'];
        // Nominatim importance is 0.0–1.0; convert to 0–100 integer
        $conf = isset($result['importance'])
            ? (int) round((float) $result['importance'] * 100)
            : null;

        // Warn on low confidence — still accept but log for review
        if ($conf !== null && $conf < 30) {
            Log::warning('[Geocoding] Low confidence result', [
                'address_id' => $address->id,
                'confidence' => $conf,
                'display'    => $result['display_name'] ?? null,
            ]);
        }

        $ttl = Carbon::now()->addDays(
            config('services.geocoding.cache_ttl_days', 90)
        );

        // Upsert into geocode_cache
        GeocodeCache::updateOrCreate(
            ['geocode_hash' => $hash],
            [
                'normalized_input'  => $normalizedInput,
                'provider'          => 'nominatim',
                'latitude'          => $lat,
                'longitude'         => $lng,
                'formatted_address' => $result['display_name'] ?? null,
                'status'            => 'hit',
                'confidence'        => $conf,
                'provider_place_id' => (string) ($result['place_id'] ?? ''),
                'provider_type'     => $result['type'] ?? null,
                'failure_reason'    => null,
                'expires_at'        => $ttl,
                'last_resolved_at'  => now(),
            ]
        );

        // Hydrate the address record
        $address->updateQuietly([
            'latitude'          => $lat,
            'longitude'         => $lng,
            'formatted_address' => $result['display_name'] ?? $address->formatted_address,
            'validation_status' => 'verified',
            'last_geocoded_at'  => now(),
            'geocode_error'     => null,
        ]);

        Log::info('[Geocoding] Geocoded successfully via Nominatim', [
            'address_id' => $address->id,
            'lat'        => $lat,
            'lng'        => $lng,
            'confidence' => $conf,
        ]);

        return true;
    }

    /**
     * Handle a Nominatim response with no results (miss).
     * Cache the miss so we do not keep calling the API for unknown addresses.
     * Short TTL so it gets retried if the address is corrected.
     */
    private function handleMiss(
        Address $address,
        string $normalizedInput,
        string $hash
    ): bool {
        $ttl = Carbon::now()->addHours(
            config('services.geocoding.failed_ttl_hours', 24)
        );

        GeocodeCache::updateOrCreate(
            ['geocode_hash' => $hash],
            [
                'normalized_input' => $normalizedInput,
                'provider'         => 'nominatim',
                'latitude'         => null,
                'longitude'        => null,
                'status'           => 'miss',
                'failure_reason'   => 'No results returned by Nominatim.',
                'expires_at'       => $ttl,
                'last_resolved_at' => now(),
            ]
        );

        $address->updateQuietly([
            'validation_status' => 'failed',
            'geocode_error'     => 'Address not found. Please check the address and try again.',
            'geocode_attempts'  => $address->geocode_attempts + 1,
        ]);

        Log::info('[Geocoding] No results from Nominatim (miss)', [
            'address_id' => $address->id,
            'hash'       => $hash,
        ]);

        return false;
    }

    /**
     * Handle a Nominatim API error (timeout, HTTP error, rate limit).
     * Do NOT cache this long-term — it is a transient error, not an address problem.
     * The job will retry via queue backoff.
     */
    private function handleFailure(
        Address $address,
        string $normalizedInput,
        string $hash,
        string $reason
    ): bool {
        // Short-lived failed cache entry to prevent concurrent duplicate requests
        $ttl = Carbon::now()->addHours(1);

        GeocodeCache::updateOrCreate(
            ['geocode_hash' => $hash],
            [
                'normalized_input' => $normalizedInput,
                'provider'         => 'nominatim',
                'latitude'         => null,
                'longitude'        => null,
                'status'           => 'failed',
                'failure_reason'   => $reason,
                'expires_at'       => $ttl,
                'last_resolved_at' => now(),
            ]
        );

        $address->updateQuietly([
            'validation_status' => 'failed',
            'geocode_error'     => 'Geocoding service error. Will retry automatically.',
            'geocode_attempts'  => $address->geocode_attempts + 1,
        ]);

        Log::error('[Geocoding] Nominatim API error', [
            'address_id' => $address->id,
            'reason'     => $reason,
        ]);

        return false;
    }
}

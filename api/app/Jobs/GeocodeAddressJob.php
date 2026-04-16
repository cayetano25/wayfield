<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Address;
use App\Services\Geocoding\GeocodingService;
use App\Services\Geocoding\NominatimException;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Geocodes a single Address record using the GeocodingService.
 *
 * This job:
 *   - Accepts an Address ID (not the model) to avoid stale model state.
 *   - Checks max attempts before running to prevent retry storms.
 *   - Uses Nominatim rate limit-safe retry configuration.
 *   - Is dispatched with a configurable delay to respect Nominatim's
 *     1-request-per-second policy.
 *   - Fails permanently (no more retries) when max attempts exceeded
 *     or when the failure is clearly not transient.
 *
 * Retry strategy:
 *   - 3 attempts maximum (configurable via GEOCODE_MAX_ATTEMPTS)
 *   - Exponential backoff: 30s, 120s, 300s
 *   - Rate limit response (429): retry after 60 seconds
 *
 * Note: GeocodeLocationJob (separate) handles reverse geocoding for
 * coordinate-only Location records. This job handles forward geocoding
 * for Address records (street address → lat/lng).
 */
class GeocodeAddressJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Maximum number of times the job will be attempted.
     * Overridden by config — defined here as a fallback.
     */
    public int $tries = 3;

    /**
     * Backoff in seconds between retries.
     * Exponential: 30s → 2 min → 5 min.
     */
    public array $backoff = [30, 120, 300];

    /**
     * Timeout for the job itself (not the HTTP request).
     */
    public int $timeout = 30;

    public function __construct(
        private readonly int $addressId,
    ) {}

    public function handle(GeocodingService $geocodingService): void
    {
        $address = Address::find($this->addressId);

        if ($address === null) {
            Log::info('[GeocodeAddressJob] Address not found — skipping.', [
                'address_id' => $this->addressId,
            ]);

            return;
        }

        // Check max attempts — do not exceed the configured limit
        $maxAttempts = config('services.geocoding.max_attempts', 3);
        if ($address->geocode_attempts >= $maxAttempts) {
            Log::warning('[GeocodeAddressJob] Max attempts exceeded — giving up.', [
                'address_id' => $this->addressId,
                'attempts'   => $address->geocode_attempts,
                'max'        => $maxAttempts,
            ]);
            $this->fail('Max geocoding attempts exceeded.');

            return;
        }

        // Skip if already has coordinates (may have been geocoded via cache
        // by another job running concurrently for the same hash)
        if ($address->hasCoordinates()) {
            Log::info('[GeocodeAddressJob] Already has coordinates — skipping.', [
                'address_id' => $this->addressId,
            ]);

            return;
        }

        // Skip if not geocodeable
        if (! $address->isGeocodeable()) {
            Log::info('[GeocodeAddressJob] Address is not geocodeable — skipping.', [
                'address_id' => $this->addressId,
            ]);

            return;
        }

        try {
            $geocodingService->geocode($address);
        } catch (NominatimException $e) {
            // NominatimException from a rate limit gets a special retry
            if ($e->getCode() === 429) {
                // Back off for 60 seconds and retry
                $this->release(60);

                return;
            }
            // Other Nominatim errors: let the job fail and retry on backoff
            Log::error('[GeocodeAddressJob] Nominatim error', [
                'address_id' => $this->addressId,
                'error'      => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Dispatch this job for a given address with the configured queue delay.
     *
     * The delay ensures Nominatim's 1-request-per-second policy is respected
     * at a per-job level when combined with a single-worker queue.
     *
     * For production with concurrent workers, use a rate-limiting queue
     * driver or set max_processes=1 on the geocoding worker.
     */
    public static function dispatchForAddress(Address $address): void
    {
        if (! $address->needsGeocoding()) {
            return;
        }

        $delaySeconds = config('services.geocoding.queue_delay_seconds', 2);

        static::dispatch($address->id)
            ->onQueue('geocoding')
            ->delay(now()->addSeconds($delaySeconds));

        Log::info('[GeocodeAddressJob] Dispatched', [
            'address_id' => $address->id,
            'delay'      => $delaySeconds,
        ]);
    }
}

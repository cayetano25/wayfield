<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Location;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Reverse geocodes a coordinate-only location using Nominatim (OpenStreetMap).
 *
 * Fires after a session location is saved with coordinates and no address.
 * Populates location.name (if blank) and address.formatted_address with the
 * resolved place name. Sets address.validation_status = 'verified' on success.
 *
 * This job is background-only and never blocks the save operation.
 * If it fails, the location is unaffected — coordinates still work.
 */
class GeocodeLocationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $backoff = 30; // seconds between retries

    public function __construct(
        private readonly int $locationId
    ) {}

    public function handle(): void
    {
        $location = Location::find($this->locationId);

        if (! $location || $location->latitude === null || $location->longitude === null) {
            return; // Location deleted or no coordinates — nothing to do.
        }

        try {
            $response = Http::withHeaders([
                // Nominatim requires a User-Agent identifying your app.
                // https://nominatim.org/release-docs/develop/api/Reverse/
                'User-Agent' => 'Wayfield/1.0 (contact@wayfield.app)',
                'Accept' => 'application/json',
            ])
                ->timeout(10)
                ->get('https://nominatim.openstreetmap.org/reverse', [
                    'lat' => $location->latitude,
                    'lon' => $location->longitude,
                    'format' => 'json',
                    'zoom' => 14,    // neighbourhood level
                    'addressdetails' => 1,
                ]);

            if (! $response->successful()) {
                Log::warning('GeocodeLocationJob: Nominatim returned non-200', [
                    'location_id' => $this->locationId,
                    'status' => $response->status(),
                ]);

                return;
            }

            $data = $response->json();

            // Build a human-readable display name.
            $displayName = $this->buildDisplayName($data);

            // If the location has no name yet, suggest the geocoded name.
            if (empty($location->name) && $displayName) {
                $location->name = $displayName;
                $location->save();
            }

            // If a linked address record exists, update its formatted_address.
            if ($location->address_id && $location->address) {
                $location->address->update([
                    'formatted_address' => $displayName,
                    'validation_status' => 'verified',
                ]);
            }

        } catch (\Throwable $e) {
            // Never let a geocoding failure affect the location.
            Log::warning('GeocodeLocationJob: failed', [
                'location_id' => $this->locationId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function buildDisplayName(array $data): string
    {
        // Try to build a concise name from the Nominatim response parts.
        // Fall back to the full display_name if parts are not useful.
        $address = $data['address'] ?? [];

        $parts = array_filter([
            $address['tourism'] ?? null,
            $address['natural'] ?? null,
            $address['leisure'] ?? null,
            $address['park'] ?? null,
            $address['county'] ?? null,
            $address['state'] ?? null,
            $address['country_code'] ? strtoupper($address['country_code']) : null,
        ]);

        if (count($parts) >= 2) {
            return implode(', ', $parts);
        }

        // Fall back to the full display_name, truncated cleanly.
        $full = $data['display_name'] ?? '';

        return strlen($full) > 120 ? substr($full, 0, 117).'...' : $full;
    }
}

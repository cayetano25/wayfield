<?php

declare(strict_types=1);

namespace App\Observers;

use App\Jobs\GeocodeAddressJob;
use App\Models\Address;

/**
 * Observes Address model events and dispatches GeocodeAddressJob
 * when a meaningful address change is detected.
 *
 * "Meaningful" means the actual address content changed —
 * not just metadata updates (validation_status, geocode_attempts, etc.).
 *
 * GeocodingService calls updateQuietly() which bypasses observers,
 * so geocoding updates never re-trigger this observer.
 */
class AddressObserver
{
    /**
     * Fields whose changes should trigger re-geocoding.
     * Changes to ANY of these fields will dispatch a new geocoding job.
     */
    private const GEOCODING_FIELDS = [
        'address_line_1',
        'address_line_2',
        'address_line_3',
        'locality',
        'administrative_area',
        'postal_code',
        'country_code',
    ];

    /**
     * Called after a new Address is created.
     * Always dispatch geocoding for new addresses (if geocodeable).
     */
    public function created(Address $address): void
    {
        GeocodeAddressJob::dispatchForAddress($address);
    }

    /**
     * Called after an existing Address is updated.
     * Only dispatch if a meaningful address field changed.
     */
    public function updated(Address $address): void
    {
        $changed = collect(self::GEOCODING_FIELDS)
            ->some(fn ($field) => $address->wasChanged($field));

        if (! $changed) {
            return;
        }

        // Reset geocoding state so the job runs fresh.
        // updateQuietly bypasses observers — no infinite loop.
        $address->updateQuietly([
            'latitude'          => null,
            'longitude'         => null,
            'validation_status' => 'unverified',
            'geocode_hash'      => null,
            'geocode_attempts'  => 0,
            'geocode_error'     => null,
            'last_geocoded_at'  => null,
        ]);

        // Reload to pick up the reset state before checking needsGeocoding()
        $address->refresh();

        GeocodeAddressJob::dispatchForAddress($address);
    }
}

<?php

declare(strict_types=1);

namespace App\Services\Sessions;

use App\Jobs\GeocodeLocationJob;
use App\Models\Location;
use App\Models\Session;
use App\Services\Address\AddressService;

/**
 * Resolves and persists session location data based on location_type.
 *
 * Three modes:
 *   hotel       — no location record; session inherits workshop hotel
 *   address     — creates/updates a Location with a structured Address
 *   coordinates — creates/updates a Location with lat/lng; queues geocoding
 */
final class SessionLocationService
{
    public function __construct(
        private readonly AddressService $addressService
    ) {}

    /**
     * Apply location data from a validated request to a session.
     * Handles create and update — safe to call on both.
     *
     * @param  Session  $session  The session being created or updated (already saved)
     * @param  array  $data  Validated request data
     */
    public function applyLocation(Session $session, array $data): void
    {
        $type = $data['location_type'] ?? null;
        $notes = $data['location_notes'] ?? null;

        if ($type === null) {
            $this->clearLocation($session, $notes);

            return;
        }

        match ($type) {
            Session::LOCATION_TYPE_HOTEL => $this->applyHotel($session, $notes),
            Session::LOCATION_TYPE_ADDRESS => $this->applyAddress($session, $data, $notes),
            Session::LOCATION_TYPE_COORDINATES => $this->applyCoordinates($session, $data, $notes),
        };
    }

    // ─── Private handlers ─────────────────────────────────────────────────────

    private function clearLocation(Session $session, ?string $notes): void
    {
        $session->update([
            'location_id' => null,
            'location_type' => null,
            'location_notes' => $notes,
        ]);
    }

    private function applyHotel(Session $session, ?string $notes): void
    {
        // Hotel type: no location record. Resolved from workshop_logistics at display time.
        $session->update([
            'location_id' => null,
            'location_type' => Session::LOCATION_TYPE_HOTEL,
            'location_notes' => $notes,
        ]);
    }

    private function applyAddress(Session $session, array $data, ?string $notes): void
    {
        $addressData = $data['address'];

        if ($session->location_id && ! $session->usesCoordinates()) {
            // Update the existing location's address.
            $location = $session->location;
            if ($location->address_id) {
                $this->addressService->updateFromRequest($location->address, $addressData);
            } else {
                $address = $this->addressService->createFromRequest($addressData);
                $location->update(['address_id' => $address->id]);
            }
        } else {
            // Create a new location record with a new address.
            $address = $this->addressService->createFromRequest($addressData);
            $location = Location::create([
                'organization_id' => $session->workshop->organization_id,
                'name' => $data['location_name'] ?? null,
                'address_id' => $address->id,
            ]);
        }

        $session->update([
            'location_id' => $location->id,
            'location_type' => Session::LOCATION_TYPE_ADDRESS,
            'location_notes' => $notes,
        ]);
    }

    private function applyCoordinates(Session $session, array $data, ?string $notes): void
    {
        $lat = (float) $data['latitude'];
        $lng = (float) $data['longitude'];
        $name = $data['location_name'] ?? null;

        if ($session->location_id && $session->usesCoordinates()) {
            // Update the existing coordinate location in place.
            $session->location->update([
                'name' => $name,
                'latitude' => $lat,
                'longitude' => $lng,
            ]);
            $location = $session->location;
        } else {
            // Create a new coordinate-only location.
            $location = Location::create([
                'organization_id' => $session->workshop->organization_id,
                'name' => $name,
                'latitude' => $lat,
                'longitude' => $lng,
            ]);
        }

        $session->update([
            'location_id' => $location->id,
            'location_type' => Session::LOCATION_TYPE_COORDINATES,
            'location_notes' => $notes,
        ]);

        // Dispatch background reverse geocoding — optional enrichment only.
        GeocodeLocationJob::dispatch($location->id);
    }

    // ─── Public resolution helper ─────────────────────────────────────────────

    /**
     * Returns the resolved location display data for a session.
     * Used by serializers to build the location response.
     *
     * @return array{
     *     type: string|null,
     *     notes: string|null,
     *     name: string|null,
     *     latitude: float|null,
     *     longitude: float|null,
     *     address: array|null,
     *     maps_url: string|null
     * }
     */
    public function resolveForDisplay(Session $session): array
    {
        $type = $session->location_type;
        $notes = $session->location_notes;

        if ($type === Session::LOCATION_TYPE_HOTEL) {
            $hotel = $session->workshop->logistics;

            return [
                'type' => 'hotel',
                'notes' => $notes,
                'name' => $hotel?->hotel_name ?? 'Workshop Hotel',
                'latitude' => null,
                'longitude' => null,
                'address' => $hotel?->hotel_address_id
                    ? $this->addressService->toApiResponse($hotel->hotelAddress)
                    : null,
                'maps_url' => null,
            ];
        }

        if ($type === Session::LOCATION_TYPE_COORDINATES) {
            $loc = $session->location;
            $lat = $loc?->latitude;
            $lng = $loc?->longitude;

            return [
                'type' => 'coordinates',
                'notes' => $notes,
                'name' => $loc?->name,
                'latitude' => $lat,
                'longitude' => $lng,
                'address' => null,
                'maps_url' => $lat && $lng
                    ? "https://www.google.com/maps?q={$lat},{$lng}"
                    : null,
            ];
        }

        if ($type === Session::LOCATION_TYPE_ADDRESS) {
            $loc = $session->location;

            return [
                'type' => 'address',
                'notes' => $notes,
                'name' => $loc?->name,
                'latitude' => $loc?->latitude,
                'longitude' => $loc?->longitude,
                'address' => $loc?->address
                    ? $this->addressService->toApiResponse($loc->address)
                    : null,
                'maps_url' => $loc?->latitude && $loc?->longitude
                    ? "https://www.google.com/maps?q={$loc->latitude},{$loc->longitude}"
                    : null,
            ];
        }

        return [
            'type' => null,
            'notes' => $notes,
            'name' => null,
            'latitude' => null,
            'longitude' => null,
            'address' => null,
            'maps_url' => null,
        ];
    }
}

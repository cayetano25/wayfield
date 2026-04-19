<?php

namespace App\Http\Resources;

use App\Services\Address\AddressService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public-safe logistics fields.
 *
 * MUST NOT expose: id, workshop_id, created_at, updated_at,
 * or any field added to workshop_logistics that is not explicitly listed here.
 */
class PublicWorkshopLogisticsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $hotelAddressObject = null;

        if ($this->hotelAddress !== null) {
            $hotelAddressObject = app(AddressService::class)->toApiResponse($this->hotelAddress);
        }

        return [
            'hotel_name' => $this->hotel_name,
            'hotel_address' => $this->hotel_address,
            'hotel_address_object' => $hotelAddressObject,
            'hotel_phone' => $this->hotel_phone,
            'hotel_notes' => $this->hotel_notes,
            'parking_details' => $this->parking_details,
            'meeting_room_details' => $this->meeting_room_details,
            'meetup_instructions' => $this->meetup_instructions,
        ];
    }
}

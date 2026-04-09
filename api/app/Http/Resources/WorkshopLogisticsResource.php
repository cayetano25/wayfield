<?php

namespace App\Http\Resources;

use App\Services\Address\AddressService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkshopLogisticsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $hotelAddressData = null;

        if ($this->hotelAddress !== null) {
            $hotelAddressData = app(AddressService::class)->toApiResponse($this->hotelAddress);
        }

        return [
            'id' => $this->id,
            'hotel_name' => $this->hotel_name,
            'hotel_address' => $this->hotel_address,  // legacy varchar — deprecated
            'hotel_address_object' => $hotelAddressData,
            'hotel_phone' => $this->hotel_phone,
            'hotel_notes' => $this->hotel_notes,
            'parking_details' => $this->parking_details,
            'meeting_room_details' => $this->meeting_room_details,
            'meetup_instructions' => $this->meetup_instructions,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

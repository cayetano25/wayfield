<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkshopLogisticsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                   => $this->id,
            'hotel_name'           => $this->hotel_name,
            'hotel_address'        => $this->hotel_address,
            'hotel_phone'          => $this->hotel_phone,
            'hotel_notes'          => $this->hotel_notes,
            'parking_details'      => $this->parking_details,
            'meeting_room_details' => $this->meeting_room_details,
            'meetup_instructions'  => $this->meetup_instructions,
            'updated_at'           => $this->updated_at?->toIso8601String(),
        ];
    }
}

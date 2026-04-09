<?php

namespace App\Http\Resources;

use App\Services\Address\AddressService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LocationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $addressData = null;

        if ($this->address !== null) {
            $addressData = app(AddressService::class)->toApiResponse($this->address);
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'address_line_1' => $this->address_line_1,
            'address_line_2' => $this->address_line_2,
            'city' => $this->city,
            'state_or_region' => $this->state_or_region,
            'postal_code' => $this->postal_code,
            'country' => $this->country,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'address' => $addressData,
        ];
    }
}

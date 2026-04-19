<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public-safe location view — city and state/region only.
 *
 * NEVER exposes: address_line_1, address_line_2, postal_code, latitude, longitude.
 * The public endpoint shows general location only; full address is organizer-only.
 */
class PublicLocationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'city' => $this->city,
            'state_or_region' => $this->state_or_region,
        ];
    }
}

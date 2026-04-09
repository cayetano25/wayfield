<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public-safe leader view.
 *
 * STRICT privacy enforcement — exposes ONLY the fields allowed per the spec:
 *   first_name, last_name, display_name, profile_image_url, bio, website_url,
 *   city, state_or_region
 *
 * NEVER exposes:
 *   email, phone_number, address_line_1, address_line_2, postal_code, country,
 *   user_id
 */
class PublicLeaderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'display_name' => $this->display_name,
            'profile_image_url' => $this->profile_image_url,
            'bio' => $this->bio,
            'website_url' => $this->website_url,
            'city' => $this->city,
            'state_or_region' => $this->state_or_region,
        ];
    }
}

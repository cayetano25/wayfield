<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Leader's view of their own profile.
 * Includes all their personal fields including private address fields.
 * Never returned to other parties.
 */
class LeaderSelfProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'user_id'           => $this->user_id,
            'first_name'        => $this->first_name,
            'last_name'         => $this->last_name,
            'display_name'      => $this->display_name,
            'bio'               => $this->bio,
            'profile_image_url' => $this->profile_image_url,
            'website_url'       => $this->website_url,
            'email'             => $this->email,
            'phone_number'      => $this->phone_number,
            'address_line_1'    => $this->address_line_1,
            'address_line_2'    => $this->address_line_2,
            'city'              => $this->city,
            'state_or_region'   => $this->state_or_region,
            'postal_code'       => $this->postal_code,
            'country'           => $this->country,
            'created_at'        => $this->created_at?->toIso8601String(),
            'updated_at'        => $this->updated_at?->toIso8601String(),
        ];
    }
}

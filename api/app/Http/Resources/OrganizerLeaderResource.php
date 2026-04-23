<?php

namespace App\Http\Resources;

use App\Services\Address\AddressService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Full leader view for organizers — includes private contact fields.
 * Never returned in public or participant-facing endpoints.
 */
class OrganizerLeaderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'display_name' => $this->display_name,
            'bio' => $this->bio,
            'profile_image_url' => $this->profile_image_url,
            'website_url' => $this->website_url,
            'email' => $this->email,
            'phone_number' => $this->phone_number,
            'address_line_1' => $this->address_line_1,
            'address_line_2' => $this->address_line_2,
            'city' => $this->city,
            'state_or_region' => $this->state_or_region,
            'postal_code' => $this->postal_code,
            'country' => $this->country,
            'address' => $this->whenLoaded('address', fn () => $this->address ? app(AddressService::class)->toApiResponse($this->address) : null
            ),
            'is_linked_to_user' => $this->isLinkedToUser(),
            // True when the leader joined via self-enrollment (no invitation) and has a linked account.
            // invitation_id is only present on the model when loaded through a workshop_leaders pivot.
            'is_self_enrolled' => $this->user_id !== null && ($this->invitation_id ?? null) === null,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

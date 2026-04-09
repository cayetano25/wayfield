<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Leader;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Serializes a Leader record for the session detail response.
 *
 * Phone number visibility (non-negotiable backend rule):
 *   Visible to: owner, admin, staff (operational org members)
 *   Hidden from: billing_admin, participants, unauthenticated
 *
 * Per PERMISSIONS_AND_PRIVACY_MODEL.md and LEADER_SYSTEM.md:
 *   Leader phone_number is never returned to billing_admin, participants, or public endpoints.
 *
 * $showPhone is resolved once by OrganizerSessionResource (avoiding N+1 per-leader queries)
 * and injected via withShowPhone() before the collection is rendered.
 */
class SessionLeaderResource extends JsonResource
{
    private bool $showPhone = false;

    /**
     * Set whether the requesting user may see the leader's phone number.
     * Call this before adding to a collection in OrganizerSessionResource.
     */
    public function withShowPhone(bool $value): static
    {
        $this->showPhone = $value;

        return $this;
    }

    /**
     * @param  Leader  $resource
     */
    public function toArray(Request $request): array
    {
        /** @var Leader $leader */
        $leader = $this->resource;

        return [
            'id' => $leader->id,
            'first_name' => $leader->first_name,
            'last_name' => $leader->last_name,
            'display_name' => $leader->display_name,
            'bio' => $leader->bio,
            'profile_image_url' => $leader->profile_image_url,
            'city' => $leader->city,
            'state_or_region' => $leader->state_or_region,
            // role_label from the session_leaders pivot (e.g. "Lead Instructor")
            'role_label' => $leader->pivot?->role_label,
            // phone_number: only for operational org members (owner, admin, staff)
            'phone_number' => $this->showPhone ? $leader->phone_number : null,
            'phone_visible' => $this->showPhone,
        ];
    }
}

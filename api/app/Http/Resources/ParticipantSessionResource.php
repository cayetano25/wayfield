<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Session resource for authenticated registered participants.
 * Exposes meeting_url only for virtual/hybrid sessions when the participant is registered.
 * Never exposes meeting_url in public contexts — use PublicSessionResource for that.
 */
class ParticipantSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Resolve location: session's own location takes priority,
        // then fall back to the workshop's default location.
        // Only return null when no location record exists at all.
        $resolvedLocation = $this->location
            ?? ($this->relationLoaded('workshop') ? $this->workshop?->defaultLocation : null);

        return [
            'id' => $this->id,
            'workshop_id' => $this->workshop_id,
            'track_id' => $this->track_id,
            'title' => $this->title,
            'description' => $this->description,
            'start_at' => $this->start_at?->toIso8601String(),
            'end_at' => $this->end_at?->toIso8601String(),
            'location_id' => $this->location_id,
            'location' => $resolvedLocation ? new LocationResource($resolvedLocation) : null,
            'capacity' => $this->capacity,
            'delivery_type' => $this->delivery_type,
            'virtual_participation_allowed' => $this->virtual_participation_allowed,
            // meeting_url exposed to registered participants for virtual/hybrid sessions
            'meeting_url' => $this->requiresMeetingUrl() ? $this->meeting_url : null,
            'meeting_platform' => $this->requiresMeetingUrl() ? $this->meeting_platform : null,
            'meeting_instructions' => $this->requiresMeetingUrl() ? $this->meeting_instructions : null,
            'is_published' => $this->is_published,
            'is_addon' => $this->session_type === 'addon',
        ];
    }
}

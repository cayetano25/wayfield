<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Session resource for public workshop pages.
 * NEVER exposes meeting_url, meeting_id, meeting_passcode, or any private fields.
 */
class PublicSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $location = $this->relationLoaded('location') ? $this->location : null;

        return [
            'id' => $this->id,
            'track_id' => $this->track_id,
            'track_name' => $this->relationLoaded('track') ? $this->track?->name : null,
            'title' => $this->title,
            'description' => $this->description,
            'start_at' => $this->start_at?->toIso8601String(),
            'end_at' => $this->end_at?->toIso8601String(),
            'delivery_type' => $this->delivery_type,
            'virtual_participation_allowed' => $this->virtual_participation_allowed,
            'is_addon' => $this->session_type === 'addon',
            'location_city' => $location?->city,
            'location_state' => $location?->state_or_region,
            // meeting_url, meeting_id, meeting_passcode are intentionally excluded
        ];
    }
}

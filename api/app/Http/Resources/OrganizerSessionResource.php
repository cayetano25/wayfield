<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrganizerSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                           => $this->id,
            'workshop_id'                  => $this->workshop_id,
            'track_id'                     => $this->track_id,
            'title'                        => $this->title,
            'description'                  => $this->description,
            'start_at'                     => $this->start_at?->toIso8601String(),
            'end_at'                       => $this->end_at?->toIso8601String(),
            'location_id'                  => $this->location_id,
            'location'                     => $this->whenLoaded('location', fn () => new LocationResource($this->location)),
            'capacity'                     => $this->capacity,
            'delivery_type'                => $this->delivery_type,
            'virtual_participation_allowed' => $this->virtual_participation_allowed,
            'meeting_platform'             => $this->meeting_platform,
            'meeting_url'                  => $this->meeting_url,
            'meeting_instructions'         => $this->meeting_instructions,
            'meeting_id'                   => $this->meeting_id,
            'meeting_passcode'             => $this->meeting_passcode,
            'notes'                        => $this->notes,
            'is_published'                 => $this->is_published,
            'header_image_url'             => $this->header_image_url,
            'created_at'                   => $this->created_at?->toIso8601String(),
            'updated_at'                   => $this->updated_at?->toIso8601String(),
        ];
    }
}

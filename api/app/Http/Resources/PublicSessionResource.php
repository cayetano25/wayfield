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
        return [
            'id'                           => $this->id,
            'track_id'                     => $this->track_id,
            'title'                        => $this->title,
            'description'                  => $this->description,
            'start_at'                     => $this->start_at?->toIso8601String(),
            'end_at'                       => $this->end_at?->toIso8601String(),
            'delivery_type'                => $this->delivery_type,
            'virtual_participation_allowed' => $this->virtual_participation_allowed,
            // meeting_url, meeting_id, meeting_passcode are intentionally excluded
        ];
    }
}

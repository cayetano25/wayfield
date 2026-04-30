<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * Session resource for public workshop pages.
 *
 * NEVER exposes:
 * - meeting_url, meeting_id, meeting_passcode, meeting_instructions
 * - location_id, location address details
 * - full description (preview only — 120 chars)
 */
class PublicSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                           => $this->id,
            'track_id'                     => $this->track_id,
            'track_name'                   => $this->relationLoaded('track') ? $this->track?->name : null,
            'title'                        => $this->title,
            'description_preview'          => $this->description
                ? Str::limit(strip_tags($this->description), 120)
                : null,
            'start_at'                     => $this->start_at?->toIso8601String(),
            'end_at'                       => $this->end_at?->toIso8601String(),
            'delivery_type'                => $this->delivery_type,
            'virtual_participation_allowed' => $this->virtual_participation_allowed,
            'is_addon'                     => $this->session_type === 'addon',
            'session_type'                 => $this->session_type,
            // meeting_url, meeting_id, meeting_passcode intentionally excluded
            // location details intentionally excluded
        ];
    }
}

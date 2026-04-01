<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SessionSelectionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'registration_id'  => $this->registration_id,
            'session_id'       => $this->session_id,
            'selection_status' => $this->selection_status,
            'session'          => $this->whenLoaded('session', fn () => new ParticipantSessionResource($this->session)),
            'created_at'       => $this->created_at?->toIso8601String(),
            'updated_at'       => $this->updated_at?->toIso8601String(),
        ];
    }
}

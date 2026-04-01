<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SessionLeaderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'session_id' => $this->session_id,
            'leader'     => $this->whenLoaded('leader', fn () => new OrganizerLeaderResource($this->leader)),
            'role_label' => $this->role_label,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}

<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Serializes a SessionLeader (pivot) record for the session leader management endpoints.
 * Used by SessionLeaderController to represent an assignment row, not the Leader entity itself.
 */
class SessionLeaderAssignmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'session_id' => $this->session_id,
            'leader' => $this->whenLoaded('leader', fn () => new OrganizerLeaderResource($this->leader)),
            'role_label' => $this->role_label,
            'role_in_session' => $this->role_in_session,
            'assignment_status' => $this->assignment_status,
            'is_primary' => (bool) $this->is_primary,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}

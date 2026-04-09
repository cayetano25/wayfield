<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeaderInvitationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'workshop_id' => $this->workshop_id,
            'invited_email' => $this->invited_email,
            'invited_first_name' => $this->invited_first_name,
            'invited_last_name' => $this->invited_last_name,
            'status' => $this->status,
            'expires_at' => $this->expires_at?->toIso8601String(),
            'responded_at' => $this->responded_at?->toIso8601String(),
            'is_actionable' => $this->isActionable(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}

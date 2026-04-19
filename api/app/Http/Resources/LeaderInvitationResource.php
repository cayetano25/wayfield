<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LeaderInvitationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $isExpired = $this->isExpired();
        // If time-expired but status is still 'pending', surface 'expired' to callers.
        $status = ($isExpired && $this->status === 'pending') ? 'expired' : $this->status;

        $workshop = $this->buildWorkshopShape();

        return [
            'invitation_id' => $this->id,
            'status' => $status,
            'invited_email' => $this->invited_email,
            'invited_first_name' => $this->invited_first_name,
            'invited_last_name' => $this->invited_last_name,
            'expires_at' => $this->expires_at?->toIso8601String(),
            'is_expired' => $isExpired,
            'organization' => $this->whenLoaded('organization', fn () => [
                'id' => $this->organization->id,
                'name' => $this->organization->name,
                'slug' => $this->organization->slug,
            ]),
            'workshop' => $workshop,
            'sessions_assigned' => [],

            // Legacy fields kept for backwards compatibility with existing callers.
            'id' => $this->id,
            'organization_id' => $this->organization_id,
            'workshop_id' => $this->workshop_id,
            'responded_at' => $this->responded_at?->toIso8601String(),
            'is_actionable' => $this->isActionable(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    private function buildWorkshopShape(): ?array
    {
        if (! $this->workshop_id || ! $this->relationLoaded('workshop') || ! $this->workshop) {
            return null;
        }

        $w = $this->workshop;

        $location = ['city' => null, 'state_or_region' => null];
        if ($w->relationLoaded('defaultLocation') && $w->defaultLocation) {
            $location = [
                'city' => $w->defaultLocation->city,
                'state_or_region' => $w->defaultLocation->state_or_region,
            ];
        }

        return [
            'id' => $w->id,
            'title' => $w->title,
            'description' => $w->description,
            'start_date' => $w->start_date?->toDateString(),
            'end_date' => $w->end_date?->toDateString(),
            'timezone' => $w->timezone,
            'status' => $w->status,
            'location' => $location,
            'leaders_count' => $w->confirmedLeaders()->count(),
            'sessions_count' => $w->sessions()->count(),
        ];
    }
}

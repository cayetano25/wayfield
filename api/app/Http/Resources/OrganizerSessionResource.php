<?php

namespace App\Http\Resources;

use App\Models\Leader;
use App\Models\Organization;
use App\Models\User;
use App\Services\Sessions\SessionLocationService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrganizerSessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'workshop_id' => $this->workshop_id,
            'track_id' => $this->track_id,
            'title' => $this->title,
            'description' => $this->description,
            'start_at' => $this->start_at?->toIso8601String(),
            'end_at' => $this->end_at?->toIso8601String(),
            'location' => app(SessionLocationService::class)->resolveForDisplay($this->resource),
            'capacity' => $this->capacity,
            'delivery_type' => $this->delivery_type,
            'virtual_participation_allowed' => $this->virtual_participation_allowed,
            'meeting_platform' => $this->meeting_platform,
            'meeting_url' => $this->meeting_url,
            'meeting_instructions' => $this->meeting_instructions,
            'meeting_id' => $this->meeting_id,
            'meeting_passcode' => $this->meeting_passcode,
            'notes' => $this->notes,
            'is_published' => $this->is_published,
            'header_image_url' => $this->header_image_url,
            // Access-control fields
            'session_type' => $this->session_type,
            'publication_status' => $this->publication_status,
            'participant_visibility' => $this->participant_visibility,
            'enrollment_mode' => $this->enrollment_mode,
            'requires_separate_entitlement' => $this->requires_separate_entitlement,
            'selection_opens_at' => $this->selection_opens_at?->toIso8601String(),
            'selection_closes_at' => $this->selection_closes_at?->toIso8601String(),
            'leaders' => $this->whenLoaded('leaders', function () use ($request): array {
                // Resolve phone visibility once for the entire collection to avoid N+1.
                // Allowed: owner, admin, staff. Denied: billing_admin, participants, public.
                $showPhone = $this->resolveShowPhone($request);

                return $this->resource->leaders
                    ->map(fn (Leader $leader) => (new SessionLeaderResource($leader))->withShowPhone($showPhone))
                    ->values()
                    ->all();
            }),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Determines once whether the requesting user may see leader phone numbers.
     * Requires workshop.organization to be loaded on the session.
     */
    private function resolveShowPhone(Request $request): bool
    {
        /** @var User|null $user */
        $user = $request->user();

        if (! $user instanceof User) {
            return false;
        }

        /** @var Organization|null $org */
        $org = $this->resource->workshop?->organization ?? null;

        if (! $org instanceof Organization) {
            return false;
        }

        // Allowed: owner, admin, staff
        // Denied:  billing_admin, non-members
        return $org->isOperationalMember($user);
    }
}

<?php

namespace App\Domain\Sessions\Actions;

use App\Models\Session;
use App\Models\Workshop;

class CreateSessionAction
{
    public function execute(Workshop $workshop, array $data): Session
    {
        $publicationStatus = $data['publication_status'] ?? 'draft';

        return Session::create([
            'workshop_id' => $workshop->id,
            'track_id' => $data['track_id'] ?? null,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'start_at' => $data['start_at'],
            'end_at' => $data['end_at'],
            // location_id is managed by SessionLocationService after session creation
            'capacity' => $data['capacity'] ?? null,
            'delivery_type' => $data['delivery_type'] ?? 'in_person',
            'virtual_participation_allowed' => $data['virtual_participation_allowed'] ?? false,
            'meeting_platform' => $data['meeting_platform'] ?? null,
            'meeting_url' => $data['meeting_url'] ?? null,
            'meeting_instructions' => $data['meeting_instructions'] ?? null,
            'meeting_id' => $data['meeting_id'] ?? null,
            'meeting_passcode' => $data['meeting_passcode'] ?? null,
            'notes' => $data['notes'] ?? null,
            // Dual-write during transition: publication_status is canonical;
            // is_published kept in sync for backwards-compat.
            'publication_status' => $publicationStatus,
            'is_published' => $publicationStatus === 'published',
            // Access-control fields (addon sessions feature)
            'session_type' => $data['session_type'] ?? 'standard',
            'participant_visibility' => $data['participant_visibility'] ?? 'visible',
            'enrollment_mode' => $data['enrollment_mode'] ?? 'self_select',
            'requires_separate_entitlement' => $data['requires_separate_entitlement'] ?? false,
            'selection_opens_at' => $data['selection_opens_at'] ?? null,
            'selection_closes_at' => $data['selection_closes_at'] ?? null,
        ]);
    }
}

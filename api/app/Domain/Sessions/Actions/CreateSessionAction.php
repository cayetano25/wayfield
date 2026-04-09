<?php

namespace App\Domain\Sessions\Actions;

use App\Models\Session;
use App\Models\Workshop;

class CreateSessionAction
{
    public function execute(Workshop $workshop, array $data): Session
    {
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
            'is_published' => false,
        ]);
    }
}

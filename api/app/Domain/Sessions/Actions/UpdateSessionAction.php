<?php

namespace App\Domain\Sessions\Actions;

use App\Models\Session;

class UpdateSessionAction
{
    public function execute(Session $session, array $data): Session
    {
        $allowed = [
            // location_id, location_type, location_notes managed by SessionLocationService
            'track_id', 'title', 'description', 'start_at', 'end_at',
            'capacity', 'delivery_type', 'virtual_participation_allowed',
            'meeting_platform', 'meeting_url', 'meeting_instructions',
            'meeting_id', 'meeting_passcode', 'notes',
        ];

        $session->fill(array_intersect_key($data, array_flip($allowed)));
        $session->save();

        return $session->fresh();
    }
}

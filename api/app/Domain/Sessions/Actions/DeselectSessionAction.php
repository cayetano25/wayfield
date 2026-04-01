<?php

namespace App\Domain\Sessions\Actions;

use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;

class DeselectSessionAction
{
    public function execute(Registration $registration, Session $session): void
    {
        SessionSelection::where('registration_id', $registration->id)
            ->where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->update(['selection_status' => 'canceled']);
    }
}

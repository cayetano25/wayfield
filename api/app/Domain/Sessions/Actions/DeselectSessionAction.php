<?php

namespace App\Domain\Sessions\Actions;

use App\Exceptions\CannotDeselectCheckedInSessionException;
use App\Models\AttendanceRecord;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;

class DeselectSessionAction
{
    public function execute(Registration $registration, Session $session): void
    {
        // Guard: cannot deselect a session that has already been checked into.
        $attendance = AttendanceRecord::where('session_id', $session->id)
            ->where('user_id', $registration->user_id)
            ->first();

        if ($attendance && $attendance->status === 'checked_in') {
            throw new CannotDeselectCheckedInSessionException(
                'You cannot remove a session you have already checked into.'
            );
        }

        SessionSelection::where('registration_id', $registration->id)
            ->where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->update(['selection_status' => 'canceled']);
    }
}

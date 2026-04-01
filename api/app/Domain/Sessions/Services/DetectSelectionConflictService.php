<?php

namespace App\Domain\Sessions\Services;

use App\Domain\Sessions\Exceptions\SessionConflictException;
use App\Models\Registration;
use App\Models\Session;
use Illuminate\Support\Facades\DB;

class DetectSelectionConflictService
{
    /**
     * Check if a participant already has an overlapping session selected.
     *
     * @throws SessionConflictException
     */
    public function checkForConflict(Registration $registration, Session $newSession): void
    {
        $conflict = DB::table('session_selections')
            ->join('sessions', 'sessions.id', '=', 'session_selections.session_id')
            ->where('session_selections.registration_id', $registration->id)
            ->where('session_selections.selection_status', 'selected')
            ->where('sessions.id', '!=', $newSession->id)
            ->where(function ($query) use ($newSession) {
                // Overlapping: existing session starts before new ends AND ends after new starts
                $query->where('sessions.start_at', '<', $newSession->end_at)
                      ->where('sessions.end_at', '>', $newSession->start_at);
            })
            ->exists();

        if ($conflict) {
            throw new SessionConflictException(
                "Session '{$newSession->title}' conflicts with an already-selected session."
            );
        }
    }
}

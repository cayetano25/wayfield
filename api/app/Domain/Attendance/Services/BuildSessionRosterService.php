<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendanceRecord;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use Illuminate\Support\Collection;

class BuildSessionRosterService
{
    /**
     * Build the roster for a session.
     *
     * For session_based workshops: users who have an active session_selection for this session.
     * For event_based workshops: users who are actively registered to the workshop.
     *
     * Returns a collection of objects each containing:
     *   - user (with phone_number available for caller to gate visibility)
     *   - registration
     *   - attendance_record (may be null — no attendance row means not_checked_in)
     */
    public function build(Session $session): Collection
    {
        $workshop = $session->workshop;

        if ($workshop->isSessionBased()) {
            return $this->buildSessionBasedRoster($session, $workshop->id);
        }

        return $this->buildEventBasedRoster($session, $workshop->id);
    }

    private function buildSessionBasedRoster(Session $session, int $workshopId): Collection
    {
        // Users with an active selection for this session
        $selections = SessionSelection::with(['registration.user'])
            ->where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->get();

        return $selections->map(function (SessionSelection $selection) use ($session) {
            $user = $selection->registration->user;
            $attendance = AttendanceRecord::where('session_id', $session->id)
                ->where('user_id', $user->id)
                ->first();

            return (object) [
                'user' => $user,
                'registration' => $selection->registration,
                'attendance_record' => $attendance,
            ];
        });
    }

    private function buildEventBasedRoster(Session $session, int $workshopId): Collection
    {
        // Users actively registered to the workshop
        $registrations = Registration::with('user')
            ->where('workshop_id', $workshopId)
            ->where('registration_status', 'registered')
            ->get();

        return $registrations->map(function (Registration $registration) use ($session) {
            $user = $registration->user;
            $attendance = AttendanceRecord::where('session_id', $session->id)
                ->where('user_id', $user->id)
                ->first();

            return (object) [
                'user' => $user,
                'registration' => $registration,
                'attendance_record' => $attendance,
            ];
        });
    }
}

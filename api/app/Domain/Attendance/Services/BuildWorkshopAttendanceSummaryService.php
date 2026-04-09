<?php

namespace App\Domain\Attendance\Services;

use App\Models\AttendanceRecord;
use App\Models\Registration;
use App\Models\Session;
use App\Models\Workshop;
use Illuminate\Support\Collection;

class BuildWorkshopAttendanceSummaryService
{
    /**
     * Build an attendance summary across all sessions of a workshop.
     *
     * Returns a collection of per-session summaries plus an overall total.
     */
    public function build(Workshop $workshop): array
    {
        $sessions = Session::where('workshop_id', $workshop->id)
            ->orderBy('start_at')
            ->get();

        $totalRegistrations = Registration::where('workshop_id', $workshop->id)
            ->where('registration_status', 'registered')
            ->count();

        $sessionSummaries = $sessions->map(function (Session $session) {
            $attendanceQuery = AttendanceRecord::where('session_id', $session->id);

            return [
                'session_id' => $session->id,
                'title' => $session->title,
                'start_at' => $session->start_at,
                'end_at' => $session->end_at,
                'checked_in' => (clone $attendanceQuery)->where('status', 'checked_in')->count(),
                'no_show' => (clone $attendanceQuery)->where('status', 'no_show')->count(),
                'not_checked_in' => (clone $attendanceQuery)->where('status', 'not_checked_in')->count(),
                'total_records' => $attendanceQuery->count(),
            ];
        });

        return [
            'workshop_id' => $workshop->id,
            'total_registrations' => $totalRegistrations,
            'sessions' => $sessionSummaries->values()->all(),
        ];
    }
}

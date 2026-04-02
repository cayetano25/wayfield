<?php

namespace App\Domain\Subscriptions\Services;

use App\Models\AttendanceRecord;
use App\Models\Organization;
use App\Models\Session;
use App\Models\Workshop;

class BuildAttendanceReportService
{
    /**
     * Build an attendance summary report for the organization.
     *
     * All data is scoped to the organization — cross-tenant leakage is impossible
     * because sessions are loaded only from workshops owned by the organization.
     *
     * @param array{workshop_id?: int, start_date?: string, end_date?: string} $filters
     * @return array<int, array{workshop: Workshop, sessions: array}>
     */
    public function build(Organization $organization, array $filters = []): array
    {
        $workshopQuery = Workshop::where('organization_id', $organization->id);

        if (isset($filters['workshop_id'])) {
            $workshopQuery->where('id', $filters['workshop_id']);
        }

        if (isset($filters['start_date'])) {
            $workshopQuery->whereDate('start_date', '>=', $filters['start_date']);
        }

        if (isset($filters['end_date'])) {
            $workshopQuery->whereDate('end_date', '<=', $filters['end_date']);
        }

        $workshops = $workshopQuery->get();

        $report = [];

        foreach ($workshops as $workshop) {
            $sessions = Session::where('workshop_id', $workshop->id)->get();

            $sessionData = $sessions->map(function (Session $session) {
                $records = AttendanceRecord::where('session_id', $session->id)->get();

                return [
                    'session_id'         => $session->id,
                    'session_title'      => $session->title,
                    'start_at'           => $session->start_at,
                    'end_at'             => $session->end_at,
                    'total_records'      => $records->count(),
                    'checked_in_count'   => $records->where('status', 'checked_in')->count(),
                    'no_show_count'      => $records->where('status', 'no_show')->count(),
                    'not_checked_in_count' => $records->where('status', 'not_checked_in')->count(),
                ];
            })->values()->all();

            $report[] = [
                'workshop_id'     => $workshop->id,
                'workshop_title'  => $workshop->title,
                'workshop_status' => $workshop->status,
                'start_date'      => $workshop->start_date,
                'end_date'        => $workshop->end_date,
                'sessions'        => $sessionData,
            ];
        }

        return $report;
    }
}

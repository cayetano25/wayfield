<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Subscriptions\Services\EnforceFeatureGateService;
use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\SessionSelection;
use App\Models\Workshop;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ReportsController extends Controller
{
    public function __construct(
        private readonly EnforceFeatureGateService $gateService,
    ) {}

    // ─── Plan gate helper ─────────────────────────────────────────────────────

    /**
     * Returns a 403 JSON plan-required response, or null if the org has access.
     * Plan code is ALWAYS resolved from the database — never from the request.
     */
    private function requireStarterPlan(Organization $organization): ?JsonResponse
    {
        if (! $this->gateService->isFeatureEnabled($organization, 'reporting')) {
            return response()->json([
                'error' => 'plan_required',
                'required_plan' => 'starter',
                'upgrade_url' => '/billing',
            ], 403);
        }

        return null;
    }

    private function isProOrAbove(Organization $organization): bool
    {
        $planCode = $organization->subscription?->plan_code ?? 'free';

        return in_array($planCode, ['pro', 'enterprise'], true);
    }

    // ─── Attendance report ────────────────────────────────────────────────────

    /**
     * GET /api/v1/organizations/{organization}/reports/attendance
     *
     * Plan gating: Starter+ (basic), Pro+ (cross-workshop trend).
     * Plan code is always resolved from the database.
     *
     * Query params:
     *   ?workshop_id=   (optional — filter to single workshop)
     *   ?start_date=    (optional — YYYY-MM-DD)
     *   ?end_date=      (optional — YYYY-MM-DD)
     */
    public function attendance(Request $request, Organization $organization): JsonResponse
    {
        $this->authorize('view', $organization);

        if ($gate = $this->requireStarterPlan($organization)) {
            return $gate;
        }

        $validated = $request->validate([
            'workshop_id' => ['nullable', 'integer'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $workshopQuery = Workshop::where('organization_id', $organization->id);

        if (! empty($validated['workshop_id'])) {
            $workshopQuery->where('id', $validated['workshop_id']);
        }

        if (! empty($validated['start_date'])) {
            $workshopQuery->whereDate('start_date', '>=', $validated['start_date']);
        }

        if (! empty($validated['end_date'])) {
            $workshopQuery->whereDate('end_date', '<=', $validated['end_date']);
        }

        $workshops = $workshopQuery->get();
        $workshopIds = $workshops->pluck('id');

        // Overall registration count across all filtered workshops
        $totalRegistered = Registration::whereIn('workshop_id', $workshopIds)
            ->where('registration_status', 'registered')
            ->count();

        // Session IDs for all filtered workshops
        $sessionIds = Session::whereIn('workshop_id', $workshopIds)->pluck('id');

        $totalCheckedIn = AttendanceRecord::whereIn('session_id', $sessionIds)
            ->where('status', 'checked_in')
            ->count();

        $totalNoShow = AttendanceRecord::whereIn('session_id', $sessionIds)
            ->where('status', 'no_show')
            ->count();

        $attendanceRate = $totalRegistered > 0
            ? round($totalCheckedIn / $totalRegistered, 4)
            : null;

        $noShowRate = $totalRegistered > 0
            ? round($totalNoShow / $totalRegistered, 4)
            : null;

        $byWorkshop = $workshops->map(function (Workshop $w) {
            $wSessionIds = Session::where('workshop_id', $w->id)->pluck('id');

            $registered = Registration::where('workshop_id', $w->id)
                ->where('registration_status', 'registered')
                ->count();

            $checkedIn = AttendanceRecord::whereIn('session_id', $wSessionIds)
                ->where('status', 'checked_in')
                ->count();

            $noShow = AttendanceRecord::whereIn('session_id', $wSessionIds)
                ->where('status', 'no_show')
                ->count();

            return [
                'workshop_id' => $w->id,
                'workshop_title' => $w->title,
                'start_date' => $w->start_date?->toDateString(),
                'registered' => $registered,
                'checked_in' => $checkedIn,
                'no_show' => $noShow,
                'attendance_rate' => $registered > 0 ? round($checkedIn / $registered, 4) : null,
            ];
        })->values();

        // by_session: only when workshop_id filter is applied
        $bySession = null;
        if (! empty($validated['workshop_id'])) {
            $wSessions = Session::whereIn('workshop_id', $workshopIds)
                ->orderBy('start_at')
                ->get();

            $bySession = $wSessions->map(function (Session $s) {
                $enrolled = SessionSelection::where('session_id', $s->id)
                    ->where('selection_status', 'selected')
                    ->count();

                $checkedIn = AttendanceRecord::where('session_id', $s->id)
                    ->where('status', 'checked_in')
                    ->count();

                $noShow = AttendanceRecord::where('session_id', $s->id)
                    ->where('status', 'no_show')
                    ->count();

                return [
                    'session_id' => $s->id,
                    'session_title' => $s->title,
                    'start_at' => $s->start_at?->toIso8601String(),
                    'enrolled' => $enrolled,
                    'checked_in' => $checkedIn,
                    'no_show' => $noShow,
                    'session_attendance_rate' => $enrolled > 0 ? round($checkedIn / $enrolled, 4) : null,
                ];
            })->values()->all();
        }

        // Trend: 12-week registration buckets — Pro+ only
        $trend = null;
        if ($this->isProOrAbove($organization)) {
            $trend = [];
            $now = Carbon::now()->startOfWeek(Carbon::MONDAY);

            for ($i = 11; $i >= 0; $i--) {
                $weekStart = $now->copy()->subWeeks($i);
                $weekEnd = $weekStart->copy()->endOfWeek(Carbon::SUNDAY);

                $count = Registration::whereIn('workshop_id', $workshopIds)
                    ->where('registration_status', 'registered')
                    ->whereBetween('registered_at', [$weekStart, $weekEnd])
                    ->count();

                $trend[] = [
                    'week_start' => $weekStart->toDateString(),
                    'registrations' => $count,
                ];
            }
        }

        $dateRange = [
            'start' => $validated['start_date'] ?? null,
            'end' => $validated['end_date'] ?? null,
        ];

        return response()->json([
            'summary' => [
                'total_registered' => $totalRegistered,
                'total_checked_in' => $totalCheckedIn,
                'total_no_show' => $totalNoShow,
                'attendance_rate' => $attendanceRate,
                'no_show_rate' => $noShowRate,
                'date_range' => $dateRange,
            ],
            'by_workshop' => $byWorkshop,
            'by_session' => $bySession,
            'trend' => $trend,
        ]);
    }

    // ─── Workshops report ─────────────────────────────────────────────────────

    /**
     * GET /api/v1/organizations/{organization}/reports/workshops
     *
     * Plan gating: Starter+.
     */
    public function workshops(Request $request, Organization $organization): JsonResponse
    {
        $this->authorize('view', $organization);

        if ($gate = $this->requireStarterPlan($organization)) {
            return $gate;
        }

        $workshops = Workshop::where('organization_id', $organization->id)
            ->with(['sessions', 'registrations'])
            ->withCount('sessions as session_count_raw')
            ->orderBy('start_date', 'desc')
            ->get();

        $data = $workshops->map(function (Workshop $w) {
            $sessions = $w->sessions;
            $registrations = $w->registrations;

            $registered = $registrations->where('registration_status', 'registered')->count();
            $sessionIds = $sessions->pluck('id');

            // Leader count: unique leaders assigned to any session in this workshop
            $leaderCount = SessionLeader::whereIn('session_id', $sessionIds)
                ->where('assignment_status', 'accepted')
                ->distinct('leader_id')
                ->count('leader_id');

            // Capacity utilization across sessions with capacity set
            $capacitySessions = $sessions->filter(fn ($s) => $s->capacity !== null);
            $capacityTotal = $capacitySessions->sum('capacity');
            $capacityUtil = null;

            if ($capacityTotal > 0) {
                $totalEnrolled = SessionSelection::whereIn('session_id', $capacitySessions->pluck('id'))
                    ->where('selection_status', 'selected')
                    ->count();
                $capacityUtil = round($totalEnrolled / $capacityTotal, 4);
            }

            // Attendance rate
            $totalCheckedIn = AttendanceRecord::whereIn('session_id', $sessionIds)
                ->where('status', 'checked_in')
                ->count();
            $attendanceRate = $registered > 0 ? round($totalCheckedIn / $registered, 4) : null;

            return [
                'workshop_id' => $w->id,
                'title' => $w->title,
                'status' => $w->status,
                'workshop_type' => $w->workshop_type,
                'start_date' => $w->start_date?->toDateString(),
                'end_date' => $w->end_date?->toDateString(),
                'session_count' => $sessions->count(),
                'leader_count' => $leaderCount,
                'registered_count' => $registered,
                'capacity_total' => $capacityTotal > 0 ? (int) $capacityTotal : null,
                'capacity_utilization' => $capacityUtil,
                'attendance_rate' => $attendanceRate,
            ];
        })->values();

        return response()->json(['data' => $data]);
    }

    // ─── Participants report ──────────────────────────────────────────────────

    /**
     * GET /api/v1/organizations/{organization}/reports/participants
     *
     * Plan gating: Starter+.
     * Requires: ?workshop_id=
     */
    public function participants(Request $request, Organization $organization): JsonResponse
    {
        $this->authorize('view', $organization);

        if ($gate = $this->requireStarterPlan($organization)) {
            return $gate;
        }

        $validated = $request->validate([
            'workshop_id' => ['required', 'integer'],
        ]);

        $workshop = Workshop::where('organization_id', $organization->id)
            ->findOrFail($validated['workshop_id']);

        $registrations = Registration::where('workshop_id', $workshop->id)
            ->where('registration_status', 'registered')
            ->with(['user'])
            ->orderBy('registered_at')
            ->get();

        $sessionIds = Session::where('workshop_id', $workshop->id)->pluck('id');

        $participants = $registrations->map(function (Registration $reg) use ($sessionIds) {
            $user = $reg->user;

            $sessionsSelected = SessionSelection::where('registration_id', $reg->id)
                ->where('selection_status', 'selected')
                ->count();

            $attendanceRecords = AttendanceRecord::where('user_id', $user->id)
                ->whereIn('session_id', $sessionIds)
                ->orderBy('checked_in_at', 'desc')
                ->get();

            $sessionsAttended = $attendanceRecords->where('status', 'checked_in')->count();
            $lastCheckIn = $attendanceRecords->where('status', 'checked_in')->first()?->checked_in_at;

            return [
                'user_id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'registered_at' => $reg->registered_at?->toIso8601String(),
                'sessions_selected' => $sessionsSelected,
                'sessions_attended' => $sessionsAttended,
                'last_check_in' => $lastCheckIn?->toIso8601String(),
            ];
        })->values();

        return response()->json([
            'workshop_title' => $workshop->title,
            'participants' => $participants,
        ]);
    }

    // ─── Export ───────────────────────────────────────────────────────────────

    /**
     * GET /api/v1/organizations/{organization}/reports/export
     *
     * Plan gating: Starter+.
     *
     * Query params:
     *   ?type=attendance|workshops|participants
     *   ?workshop_id=   (required for participants type)
     *   ?format=csv     (only csv for now)
     */
    public function export(Request $request, Organization $organization): Response|JsonResponse
    {
        $this->authorize('view', $organization);

        if ($gate = $this->requireStarterPlan($organization)) {
            return $gate;
        }

        $validated = $request->validate([
            'type' => ['required', 'string', 'in:attendance,workshops,participants'],
            'workshop_id' => ['nullable', 'integer'],
            'format' => ['nullable', 'string', 'in:csv'],
        ]);

        $type = $validated['type'];

        [$headers, $rows] = match ($type) {
            'attendance' => $this->buildAttendanceCsv($organization, $validated),
            'workshops' => $this->buildWorkshopsCsv($organization),
            'participants' => $this->buildParticipantsCsv($organization, $validated),
        };

        $filename = "wayfield-{$type}-report-".now()->format('Y-m-d').'.csv';

        $buffer = fopen('php://memory', 'w');
        fputcsv($buffer, $headers);
        foreach ($rows as $row) {
            fputcsv($buffer, $row);
        }
        rewind($buffer);
        $csvContent = stream_get_contents($buffer);
        fclose($buffer);

        return response($csvContent, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    // ─── CSV builders ─────────────────────────────────────────────────────────

    private function buildAttendanceCsv(Organization $organization, array $filters): array
    {
        $workshopQuery = Workshop::where('organization_id', $organization->id);

        if (! empty($filters['workshop_id'])) {
            $workshopQuery->where('id', $filters['workshop_id']);
        }

        $workshops = $workshopQuery->get();

        $headers = [
            'workshop_id', 'workshop_title', 'start_date',
            'registered', 'checked_in', 'no_show', 'attendance_rate',
        ];

        $rows = [];
        foreach ($workshops as $w) {
            $sessionIds = Session::where('workshop_id', $w->id)->pluck('id');
            $registered = Registration::where('workshop_id', $w->id)->where('registration_status', 'registered')->count();
            $checkedIn = AttendanceRecord::whereIn('session_id', $sessionIds)->where('status', 'checked_in')->count();
            $noShow = AttendanceRecord::whereIn('session_id', $sessionIds)->where('status', 'no_show')->count();
            $rate = $registered > 0 ? round($checkedIn / $registered, 4) : '';

            $rows[] = [$w->id, $w->title, $w->start_date?->toDateString(), $registered, $checkedIn, $noShow, $rate];
        }

        return [$headers, $rows];
    }

    private function buildWorkshopsCsv(Organization $organization): array
    {
        $workshops = Workshop::where('organization_id', $organization->id)->get();

        $headers = [
            'workshop_id', 'title', 'status', 'workshop_type',
            'start_date', 'end_date', 'session_count', 'registered_count',
        ];

        $rows = [];
        foreach ($workshops as $w) {
            $sessionCount = Session::where('workshop_id', $w->id)->count();
            $registered = Registration::where('workshop_id', $w->id)->where('registration_status', 'registered')->count();

            $rows[] = [
                $w->id, $w->title, $w->status, $w->workshop_type,
                $w->start_date?->toDateString(), $w->end_date?->toDateString(),
                $sessionCount, $registered,
            ];
        }

        return [$headers, $rows];
    }

    private function buildParticipantsCsv(Organization $organization, array $filters): array
    {
        $workshopId = $filters['workshop_id'] ?? null;

        if (! $workshopId) {
            return [['error'], [['workshop_id is required for participants export']]];
        }

        $workshop = Workshop::where('organization_id', $organization->id)->findOrFail($workshopId);

        $registrations = Registration::where('workshop_id', $workshop->id)
            ->where('registration_status', 'registered')
            ->with('user')
            ->get();

        $sessionIds = Session::where('workshop_id', $workshop->id)->pluck('id');

        $headers = [
            'user_id', 'first_name', 'last_name', 'email',
            'registered_at', 'sessions_selected', 'sessions_attended', 'last_check_in',
        ];

        $rows = [];
        foreach ($registrations as $reg) {
            $user = $reg->user;
            $sessionsSelected = SessionSelection::where('registration_id', $reg->id)->where('selection_status', 'selected')->count();
            $attendanceRecords = AttendanceRecord::where('user_id', $user->id)->whereIn('session_id', $sessionIds)->orderBy('checked_in_at', 'desc')->get();
            $sessionsAttended = $attendanceRecords->where('status', 'checked_in')->count();
            $lastCheckIn = $attendanceRecords->where('status', 'checked_in')->first()?->checked_in_at?->toIso8601String() ?? '';

            $rows[] = [
                $user->id, $user->first_name, $user->last_name, $user->email,
                $reg->registered_at?->toIso8601String() ?? '', $sessionsSelected, $sessionsAttended, $lastCheckIn,
            ];
        }

        return [$headers, $rows];
    }
}

<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Subscriptions\Services\BuildAttendanceReportService;
use App\Domain\Subscriptions\Services\BuildUsageReportService;
use App\Http\Controllers\Controller;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportingController extends Controller
{
    public function __construct(
        private readonly BuildAttendanceReportService $attendanceService,
        private readonly BuildUsageReportService      $usageService,
    ) {}

    /**
     * GET /api/v1/organizations/{organization}/reports/attendance
     *
     * Tenant-scoped attendance summary.
     * Requires `reporting` feature (Starter+) enforced by CheckFeatureAccess middleware.
     */
    public function attendance(Request $request, Organization $organization): JsonResponse
    {
        $this->authorize('view', $organization);

        $filters = array_filter([
            'workshop_id' => $request->integer('workshop_id') ?: null,
            'start_date'  => $request->input('start_date'),
            'end_date'    => $request->input('end_date'),
        ], fn ($v) => $v !== null);

        $report = $this->attendanceService->build($organization, $filters);

        return response()->json(['data' => $report]);
    }

    /**
     * GET /api/v1/organizations/{organization}/reports/workshops
     *
     * Workshop summary report for the organization.
     * Requires `reporting` feature (Starter+) enforced by CheckFeatureAccess middleware.
     */
    public function workshops(Request $request, Organization $organization): JsonResponse
    {
        $this->authorize('view', $organization);

        $query = $organization->workshops()->with(['sessions', 'registrations']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $workshops = $query->orderBy('start_date', 'desc')->get();

        $data = $workshops->map(fn ($workshop) => [
            'workshop_id'         => $workshop->id,
            'title'               => $workshop->title,
            'status'              => $workshop->status,
            'workshop_type'       => $workshop->workshop_type,
            'start_date'          => $workshop->start_date,
            'end_date'            => $workshop->end_date,
            'session_count'       => $workshop->sessions->count(),
            'registration_count'  => $workshop->registrations
                ->where('registration_status', 'registered')
                ->count(),
        ])->values();

        return response()->json(['data' => $data]);
    }

    /**
     * GET /api/v1/organizations/{organization}/reports/usage
     *
     * Usage report against plan limits.
     * Available to all plans — informational for UI limit display.
     */
    public function usage(Organization $organization): JsonResponse
    {
        $this->authorize('view', $organization);

        $report = $this->usageService->build($organization);

        return response()->json(['data' => $report]);
    }
}

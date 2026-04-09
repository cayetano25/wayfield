<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\Dashboard\DashboardMetricsService;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    /**
     * GET /api/v1/organizations/{organization}/dashboard
     *
     * Plan-aware aggregate stats for the organizer web admin dashboard.
     * Plan code is always resolved from the database — never from the request.
     */
    public function index(Organization $organization): JsonResponse
    {
        $this->authorize('view', $organization);

        $service = new DashboardMetricsService($organization);

        return response()->json([
            'core' => $service->getCoreMetrics(),
            'analytics' => [
                'attendance_metrics' => $service->getAttendanceMetrics(),
                'capacity_metrics' => $service->getCapacityMetrics(),
                'session_breakdown' => $service->getSessionBreakdown(),
                'registration_trend' => $service->getRegistrationTrend(),
            ],
            'stubs' => $service->getStubMetrics(),
        ]);
    }
}

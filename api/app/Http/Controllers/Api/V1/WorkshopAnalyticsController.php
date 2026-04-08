<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Workshop;
use App\Services\Dashboard\DashboardMetricsService;
use Illuminate\Http\JsonResponse;

class WorkshopAnalyticsController extends Controller
{
    /**
     * GET /api/v1/workshops/{workshop}/analytics
     *
     * Returns the same analytics shape as the org dashboard but scoped to
     * a single workshop. Plan code is always resolved from the database.
     */
    public function show(Workshop $workshop): JsonResponse
    {
        $this->authorize('view', $workshop);

        $org     = $workshop->organization;
        $service = new DashboardMetricsService($org, $workshop->id);

        return response()->json([
            'core'      => $service->getCoreMetrics(),
            'analytics' => [
                'attendance_metrics' => $service->getAttendanceMetrics(),
                'capacity_metrics'   => $service->getCapacityMetrics(),
                'session_breakdown'  => $service->getSessionBreakdown(),
                'registration_trend' => $service->getRegistrationTrend(),
            ],
            'stubs' => $service->getStubMetrics(),
        ]);
    }
}

<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\LoginEvent;
use App\Models\PlatformMetricDaily;
use App\Models\SecurityEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PlatformHealthController extends Controller
{
    /**
     * GET /api/v1/platform/health
     * System health snapshot for platform admins.
     * Accessible by: super_admin, ops
     */
    public function index(): JsonResponse
    {
        $today = now()->toDateString();

        $todayMetrics = PlatformMetricDaily::where('date', $today)->first();

        $recentSecurityEvents = SecurityEvent::query()
            ->whereIn('event_type', ['brute_force_detected', 'account_locked', 'suspicious_login'])
            ->where('created_at', '>=', now()->subHours(24))
            ->count();

        $recentFailedLogins = LoginEvent::whereIn('outcome', ['failed', 'unverified', 'inactive'])
            ->where('created_at', '>=', now()->subHours(1))
            ->count();

        return response()->json([
            'date'                    => $today,
            'metrics'                 => $todayMetrics,
            'last_hour_failed_logins' => $recentFailedLogins,
            'security_events_24h'     => $recentSecurityEvents,
        ]);
    }

    /**
     * GET /api/v1/platform/health/security-events
     * Recent security events for review.
     * Accessible by: super_admin, ops
     */
    public function securityEvents(Request $request): JsonResponse
    {
        $events = SecurityEvent::query()
            ->with(['user'])
            ->when($request->input('event_type'), fn ($q, $type) =>
                $q->where('event_type', $type)
            )
            ->when($request->input('user_id'), fn ($q, $userId) =>
                $q->where('user_id', $userId)
            )
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 50));

        return response()->json($events);
    }

    /**
     * GET /api/v1/platform/health/login-events
     * Recent login activity for security review.
     * Accessible by: super_admin, ops
     */
    public function loginEvents(Request $request): JsonResponse
    {
        $events = LoginEvent::query()
            ->with(['user'])
            ->when($request->input('user_id'), fn ($q, $userId) =>
                $q->where('user_id', $userId)
            )
            ->when($request->input('outcome'), fn ($q, $outcome) =>
                $q->where('outcome', $outcome)
            )
            ->when($request->input('from'), fn ($q, $from) =>
                $q->where('created_at', '>=', $from)
            )
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 50));

        return response()->json($events);
    }
}

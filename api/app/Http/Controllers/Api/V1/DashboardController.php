<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Subscriptions\Services\ResolveOrganizationEntitlementsService;
use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * GET /api/v1/organizations/{organization}/dashboard
     *
     * Aggregate stats for the organizer web admin dashboard.
     */
    public function index(Organization $organization): JsonResponse
    {
        $this->authorize('view', $organization);

        $orgId = $organization->id;

        // ── Workshops ─────────────────────────────────────────────────────────
        $workshopCounts = Workshop::where('organization_id', $orgId)
            ->selectRaw('COUNT(*) as total, SUM(status = ?) as published, SUM(status = ?) as draft', ['published', 'draft'])
            ->first();

        // ── Participants ──────────────────────────────────────────────────────
        // Distinct registered users across all workshops in this org.
        $participantTotal = Registration::whereHas('workshop', fn ($q) => $q->where('organization_id', $orgId))
            ->where('registration_status', 'registered')
            ->distinct('user_id')
            ->count('user_id');

        // ── Sessions this month ───────────────────────────────────────────────
        $sessionsThisMonth = Session::whereHas('workshop', fn ($q) => $q->where('organization_id', $orgId))
            ->whereMonth('start_at', now()->month)
            ->whereYear('start_at', now()->year)
            ->where('is_published', true)
            ->count();

        // ── Attendance today ──────────────────────────────────────────────────
        // session_ids belonging to this org (no eager loading — just IDs).
        $orgSessionIds = Session::whereHas('workshop', fn ($q) => $q->where('organization_id', $orgId))
            ->pluck('id');

        $checkedInToday = AttendanceRecord::whereIn('session_id', $orgSessionIds)
            ->where('status', 'checked_in')
            ->whereDate('checked_in_at', today())
            ->count();

        // ── Plan ──────────────────────────────────────────────────────────────
        $subscription = $organization->subscriptions()
            ->where('status', 'active')
            ->latest('created_at')
            ->first();

        $planCode = $subscription?->plan_code ?? 'free';
        $limits   = ResolveOrganizationEntitlementsService::planLimits($planCode);

        return response()->json([
            'workshops' => [
                'total'     => (int) $workshopCounts->total,
                'published' => (int) $workshopCounts->published,
                'draft'     => (int) $workshopCounts->draft,
            ],
            'participants' => [
                'total' => $participantTotal,
            ],
            'sessions_this_month' => [
                'total' => $sessionsThisMonth,
            ],
            'attendance' => [
                'checked_in_today' => $checkedInToday,
            ],
            'plan' => [
                'plan_code'          => $planCode,
                'workshops_limit'    => $limits['max_active_workshops'] ?? null,
                'participants_limit' => $limits['max_participants_per_workshop'] ?? null,
            ],
        ]);
    }
}

<?php

declare(strict_types=1);

namespace App\Http\Controllers\Platform\V1;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class OverviewController extends Controller
{
    public function index(): JsonResponse
    {
        // Organizations — grouped by whatever status values exist
        $orgByStatus = Organization::selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        // Users
        $totalUsers       = User::count();
        $activeUsers30d   = User::whereNotNull('last_login_at')
            ->where('last_login_at', '>=', now()->subDays(30))
            ->count();
        $newUsers7d       = User::where('created_at', '>=', now()->subDays(7))->count();

        // Workshops — grouped by status
        $workshopByStatus = Workshop::selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        // Plan distribution — from Stripe mirror (may be stale until webhook is wired)
        $planCounts = DB::table('stripe_subscriptions')
            ->where('status', 'active')
            ->selectRaw('plan_code, COUNT(*) as count')
            ->groupBy('plan_code')
            ->pluck('count', 'plan_code');

        // Recent platform audit events — last 10
        $recentAuditEvents = DB::table('platform_audit_logs as pal')
            ->leftJoin('admin_users as au', 'pal.admin_user_id', '=', 'au.id')
            ->leftJoin('organizations as o', 'pal.organization_id', '=', 'o.id')
            ->select(
                'pal.id',
                'pal.action',
                'pal.created_at',
                DB::raw("TRIM(CONCAT(COALESCE(au.first_name,''), ' ', COALESCE(au.last_name,''))) as admin_name"),
                'o.name as organization_name',
            )
            ->orderByDesc('pal.created_at')
            ->limit(10)
            ->get();

        return response()->json([
            'organizations' => [
                'total'      => Organization::count(),
                'by_status'  => $orgByStatus,
                'by_plan'    => [
                    'foundation' => (int) ($planCounts['foundation'] ?? 0),
                    'creator'    => (int) ($planCounts['creator']    ?? 0),
                    'studio'     => (int) ($planCounts['studio']     ?? 0),
                    'enterprise' => (int) ($planCounts['enterprise'] ?? 0),
                ],
            ],
            'users' => [
                'total'          => $totalUsers,
                'active_30_days' => $activeUsers30d,
                'new_7_days'     => $newUsers7d,
            ],
            'workshops' => [
                'total'     => Workshop::count(),
                'by_status' => $workshopByStatus,
            ],
            'stripe_note'         => 'Plan data reflects Stripe mirror tables. May be stale until webhook handler is wired (Q4).',
            'recent_audit_events' => $recentAuditEvents,
            'generated_at'        => now()->toIso8601String(),
        ]);
    }
}

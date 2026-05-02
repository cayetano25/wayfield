<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PlatformAuditController extends Controller
{
    /**
     * GET /api/platform/v1/audit-logs
     * Paginated platform audit log. Queries platform_audit_logs (not the tenant audit_logs table).
     * Accessible by: super_admin, admin only (enforced by route middleware).
     */
    public function index(Request $request): JsonResponse
    {
        $query = DB::table('platform_audit_logs as pal')
            ->leftJoin('admin_users as au', 'pal.admin_user_id', '=', 'au.id')
            ->leftJoin('organizations as o', 'pal.organization_id', '=', 'o.id')
            ->select(
                'pal.id',
                'pal.action',
                'pal.entity_type',
                'pal.entity_id',
                'pal.admin_user_id',
                DB::raw("CONCAT(COALESCE(au.first_name,''), ' ', COALESCE(au.last_name,'')) as admin_name"),
                'pal.organization_id',
                'o.name as organization_name',
                'pal.metadata_json',
                'pal.ip_address',
                'pal.created_at'
            )
            ->when($request->input('admin_user_id'), fn ($q, $id) => $q->where('pal.admin_user_id', $id))
            ->when($request->input('organization_id'), fn ($q, $id) => $q->where('pal.organization_id', $id))
            ->when($request->input('action'), fn ($q, $action) => $q->where('pal.action', 'like', "%{$action}%"))
            ->when($request->input('date_from'), fn ($q, $from) => $q->where('pal.created_at', '>=', $from))
            ->when($request->input('date_to'), fn ($q, $to) => $q->where('pal.created_at', '<=', $to))
            ->orderBy('pal.created_at', 'desc');

        $perPage = min($request->integer('per_page', 50), 100);
        $results = $query->paginate($perPage);

        return response()->json($results);
    }
}

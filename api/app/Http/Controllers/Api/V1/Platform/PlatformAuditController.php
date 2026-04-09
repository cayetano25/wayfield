<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformAuditController extends Controller
{
    /**
     * GET /api/v1/platform/audit-logs
     * Cross-tenant audit log access for platform review.
     * Accessible by: super_admin, ops
     */
    public function index(Request $request): JsonResponse
    {
        $logs = AuditLog::query()
            ->with(['organization', 'actorUser'])
            ->when($request->input('organization_id'), fn ($q, $orgId) => $q->where('organization_id', $orgId)
            )
            ->when($request->input('actor_user_id'), fn ($q, $userId) => $q->where('actor_user_id', $userId)
            )
            ->when($request->input('entity_type'), fn ($q, $type) => $q->where('entity_type', $type)
            )
            ->when($request->input('action'), fn ($q, $action) => $q->where('action', $action)
            )
            ->when($request->input('from'), fn ($q, $from) => $q->where('created_at', '>=', $from)
            )
            ->when($request->input('to'), fn ($q, $to) => $q->where('created_at', '<=', $to)
            )
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 50));

        return response()->json($logs);
    }
}

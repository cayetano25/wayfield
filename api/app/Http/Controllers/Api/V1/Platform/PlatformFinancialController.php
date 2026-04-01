<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformFinancialController extends Controller
{
    /**
     * GET /api/v1/platform/financials/invoices
     * Paginated listing of all invoices.
     * Accessible by: super_admin, finance
     */
    public function invoices(Request $request): JsonResponse
    {
        $invoices = Invoice::query()
            ->with(['organization'])
            ->when($request->input('organization_id'), fn ($q, $orgId) =>
                $q->where('organization_id', $orgId)
            )
            ->when($request->input('status'), fn ($q, $status) =>
                $q->where('status', $status)
            )
            ->when($request->input('from'), fn ($q, $from) =>
                $q->where('issued_at', '>=', $from)
            )
            ->when($request->input('to'), fn ($q, $to) =>
                $q->where('issued_at', '<=', $to)
            )
            ->orderBy('issued_at', 'desc')
            ->paginate($request->integer('per_page', 50));

        return response()->json($invoices);
    }

    /**
     * GET /api/v1/platform/financials/subscriptions
     * Active and recent subscriptions overview.
     * Accessible by: super_admin, finance
     */
    public function subscriptions(Request $request): JsonResponse
    {
        $subscriptions = Subscription::query()
            ->with(['organization'])
            ->when($request->input('plan'), fn ($q, $plan) =>
                $q->where('plan', $plan)
            )
            ->when($request->input('status'), fn ($q, $status) =>
                $q->where('status', $status)
            )
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 50));

        return response()->json($subscriptions);
    }
}

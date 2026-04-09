<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformOrganizationController extends Controller
{
    /**
     * GET /api/v1/platform/organizations
     * Global paginated listing of all organizations with subscription and usage data.
     * Accessible by: super_admin, ops, support
     */
    public function index(Request $request): JsonResponse
    {
        $organizations = Organization::query()
            ->with(['subscription', 'organizationUsers' => fn ($q) => $q->where('is_active', true)])
            ->withCount([
                'workshops',
                'workshops as active_workshops_count' => fn ($q) => $q->where('status', 'published'),
            ])
            ->when($request->input('search'), fn ($q, $search) => $q->where(fn ($q) => $q
                ->where('name', 'like', "%{$search}%")
                ->orWhere('slug', 'like', "%{$search}%")
            )
            )
            ->when($request->input('plan'), fn ($q, $plan) => $q->whereHas('subscription', fn ($q) => $q->where('plan', $plan))
            )
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 25));

        return response()->json($organizations);
    }

    /**
     * GET /api/v1/platform/organizations/{organization}
     * Full organization detail for platform review.
     */
    public function show(Organization $organization): JsonResponse
    {
        $organization->load([
            'subscription',
            'organizationUsers.user',
            'workshops' => fn ($q) => $q->orderBy('created_at', 'desc')->limit(10),
        ]);

        $organization->loadCount(['workshops', 'organizationUsers']);

        return response()->json($organization);
    }
}

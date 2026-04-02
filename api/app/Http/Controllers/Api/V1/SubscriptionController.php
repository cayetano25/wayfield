<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Subscriptions\Services\ResolveOrganizationEntitlementsService;
use App\Http\Controllers\Controller;
use App\Http\Resources\EntitlementsResource;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;

class SubscriptionController extends Controller
{
    public function __construct(
        private readonly ResolveOrganizationEntitlementsService $entitlementsService,
    ) {}

    /**
     * GET /api/v1/organizations/{organization}/subscription
     * Return the organization's active subscription summary.
     */
    public function show(Organization $organization): JsonResponse
    {
        $this->authorize('view', $organization);

        $subscription = $organization->subscriptions()
            ->whereIn('status', ['active', 'trialing'])
            ->latest('starts_at')
            ->first();

        if (! $subscription) {
            return response()->json([
                'plan_code' => 'free',
                'status'    => 'none',
                'starts_at' => null,
                'ends_at'   => null,
            ]);
        }

        return response()->json([
            'plan_code' => $subscription->plan_code,
            'status'    => $subscription->status,
            'starts_at' => $subscription->starts_at,
            'ends_at'   => $subscription->ends_at,
        ]);
    }

    /**
     * GET /api/v1/organizations/{organization}/entitlements
     * Return the resolved feature entitlements for UI consumption.
     */
    public function entitlements(Organization $organization): EntitlementsResource
    {
        $this->authorize('view', $organization);

        $resolved = $this->entitlementsService->resolve($organization);

        return new EntitlementsResource($resolved);
    }
}

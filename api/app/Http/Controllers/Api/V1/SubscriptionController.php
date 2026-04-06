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

    private const PLAN_NAMES = [
        'free'       => 'Free',
        'starter'    => 'Starter',
        'pro'        => 'Pro',
        'enterprise' => 'Enterprise',
    ];

    /**
     * GET /api/v1/organizations/{organization}/subscription
     * Return the organization's subscription, usage, limits, and invoice history.
     */
    public function show(Organization $organization): JsonResponse
    {
        $this->authorize('view', $organization);

        $resolved = $this->entitlementsService->resolve($organization);

        $subscription = $organization->subscriptions()
            ->whereIn('status', ['active', 'trialing'])
            ->latest('starts_at')
            ->first();

        $planCode = $resolved['plan'];

        return response()->json([
            'plan_code'            => $planCode,
            'plan_name'            => self::PLAN_NAMES[$planCode] ?? ucfirst($planCode),
            'status'               => $resolved['subscription_status'],
            'current_period_start' => $subscription?->starts_at,
            'current_period_end'   => $subscription?->ends_at,
            'renewal_date'         => $subscription?->ends_at,
            'limits' => [
                'max_workshops'                => $resolved['limits']['max_active_workshops'],
                'max_participants_per_workshop' => $resolved['limits']['max_participants_per_workshop'],
                'max_managers'                 => $resolved['limits']['max_managers'],
            ],
            'usage' => [
                'active_workshops'   => $resolved['usage']['active_workshop_count'],
                'total_participants' => 0,
                'managers'           => $resolved['usage']['active_manager_count'],
            ],
            'invoices' => [],
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

<?php

namespace App\Http\Middleware;

use App\Domain\Subscriptions\Services\EnforceFeatureGateService;
use App\Models\Organization;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gate a route behind a plan feature.
 *
 * Usage in routes: ->middleware('feature:reporting')
 *
 * Requires {organization} route model binding to be present.
 * Returns HTTP 403 with structured JSON on denial — never a 500.
 */
class CheckFeatureAccess
{
    public function __construct(private readonly EnforceFeatureGateService $gateService) {}

    public function handle(Request $request, Closure $next, string $featureKey): Response
    {
        $organization = $request->route('organization');

        if (! $organization instanceof Organization) {
            return response()->json([
                'error'   => 'feature_not_available',
                'message' => 'Organization context is required to check feature access.',
            ], 403);
        }

        if (! $this->gateService->isFeatureEnabled($organization, $featureKey)) {
            return response()->json([
                'error'         => 'feature_not_available',
                'message'       => 'Your current plan does not support this action.',
                'required_plan' => $this->gateService->requiredPlanFor($featureKey),
            ], 403);
        }

        return $next($request);
    }
}

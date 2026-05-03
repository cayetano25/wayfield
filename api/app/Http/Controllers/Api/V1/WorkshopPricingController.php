<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Payments\Services\FeeCalculationService;
use App\Domain\Payments\Services\PaymentFeatureFlagService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreWorkshopPricingRequest;
use App\Http\Requests\Api\V1\UpdateWorkshopPricingRequest;
use App\Http\Resources\WorkshopPricingResource;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkshopPricingController extends Controller
{
    public function __construct(
        private readonly FeeCalculationService $feeService,
        private readonly PaymentFeatureFlagService $flags,
    ) {}

    /**
     * GET /api/v1/workshops/{workshop}/pricing
     * Allowed: owner, admin
     */
    public function show(Request $request, Workshop $workshop): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $workshop);

        $pricing = WorkshopPricing::where('workshop_id', $workshop->id)->first();

        if ($pricing === null) {
            return response()->json(['data' => null]);
        }

        return response()->json(['data' => new WorkshopPricingResource($pricing)]);
    }

    /**
     * POST /api/v1/workshops/{workshop}/pricing
     * Allowed: owner, admin
     */
    public function store(StoreWorkshopPricingRequest $request, Workshop $workshop): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $workshop);

        $existing = WorkshopPricing::where('workshop_id', $workshop->id)->first();

        if ($existing !== null) {
            return response()->json([
                'error'   => 'pricing_exists',
                'message' => 'This workshop already has pricing configured. Use PUT to update.',
            ], 409);
        }

        $pricing = WorkshopPricing::create(array_merge(
            $request->validated(),
            ['workshop_id' => $workshop->id],
        ));

        return response()->json(['data' => new WorkshopPricingResource($pricing)], 201);
    }

    /**
     * PUT /api/v1/workshops/{workshop}/pricing
     * Allowed: owner, admin
     */
    public function update(UpdateWorkshopPricingRequest $request, Workshop $workshop): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $workshop);

        $pricing = WorkshopPricing::where('workshop_id', $workshop->id)->first();

        if ($pricing === null) {
            return response()->json([
                'error'   => 'not_found',
                'message' => 'No pricing found for this workshop. Use POST to create.',
            ], 404);
        }

        $pricing->update($request->validated());

        return response()->json(['data' => new WorkshopPricingResource($pricing->fresh())]);
    }

    /**
     * GET /api/v1/workshops/{workshop}/pricing/preview
     * Returns fee breakdown for the current base_price_cents and the org's plan.
     * Allowed: owner, admin
     */
    public function preview(Request $request, Workshop $workshop): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $workshop);

        $pricing = WorkshopPricing::where('workshop_id', $workshop->id)->first();

        if ($pricing === null || $pricing->base_price_cents === null) {
            return response()->json([
                'error'   => 'no_pricing',
                'message' => 'No pricing configured for this workshop.',
            ], 404);
        }

        $workshop->loadMissing('organization');
        $planCode = $workshop->organization->activeSubscription?->plan_code ?? 'foundation';

        $baseFees = $this->feeService->calculateFees($pricing->base_price_cents, $planCode);

        $depositBreakdown = null;

        if ($pricing->deposit_enabled && $pricing->deposit_amount_cents) {
            $depositFees  = $this->feeService->calculateFees($pricing->deposit_amount_cents, $planCode);
            $balanceCents = $pricing->base_price_cents - $pricing->deposit_amount_cents;
            $balanceFees  = $this->feeService->calculateFees(max(0, $balanceCents), $planCode);

            $depositBreakdown = [
                'deposit_amount'           => number_format($pricing->deposit_amount_cents / 100, 2),
                'deposit_wayfield_fee'     => number_format($depositFees->wayFieldFeeCents / 100, 2),
                'deposit_stripe_fee'       => number_format($depositFees->stripeFeeCents / 100, 2),
                'deposit_organizer_payout' => number_format($depositFees->organizerPayoutCents / 100, 2),
                'balance_amount'           => number_format(max(0, $balanceCents) / 100, 2),
                'balance_wayfield_fee'     => number_format($balanceFees->wayFieldFeeCents / 100, 2),
                'balance_stripe_fee'       => number_format($balanceFees->stripeFeeCents / 100, 2),
                'balance_organizer_payout' => number_format($balanceFees->organizerPayoutCents / 100, 2),
            ];
        }

        return response()->json([
            'base_price'          => number_format($baseFees->amountCents / 100, 2),
            'wayfield_fee'        => number_format($baseFees->wayFieldFeeCents / 100, 2),
            'stripe_fee'          => number_format($baseFees->stripeFeeCents / 100, 2),
            'organizer_payout'    => number_format($baseFees->organizerPayoutCents / 100, 2),
            'take_rate_pct'       => round($baseFees->takeRatePct * 100, 2),
            'deposit_breakdown'   => $depositBreakdown,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────

    private function authorizeOwnerOrAdmin(Request $request, Workshop $workshop): void
    {
        // Allowed: owner, admin
        // Denied: staff, billing_admin
        $role = $workshop->organization->memberRole($request->user());

        if (! in_array($role, ['owner', 'admin'], true)) {
            abort(403, 'Only organization owners and admins may manage workshop pricing.');
        }
    }
}

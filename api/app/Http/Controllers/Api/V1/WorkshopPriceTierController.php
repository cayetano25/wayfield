<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Models\WorkshopPriceTier;
use App\Domain\Payments\Services\PriceResolutionService;
use App\Domain\Payments\Services\TierSchedulingService;
use App\Domain\Shared\Services\AuditLogService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreWorkshopPriceTierRequest;
use App\Http\Requests\Api\V1\UpdateTierOrderRequest;
use App\Http\Requests\Api\V1\UpdateWorkshopPriceTierRequest;
use App\Http\Resources\WorkshopPriceTierResource;
use App\Models\Registration;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkshopPriceTierController extends Controller
{
    // Plans that support price tiers (DB enum values).
    private const TIER_PLANS = ['starter', 'pro', 'enterprise'];

    public function __construct(
        private readonly PriceResolutionService $priceResolutionService,
        private readonly TierSchedulingService $tierSchedulingService,
    ) {}

    /**
     * GET /api/v1/workshops/{workshop}/price-tiers
     * Allowed: owner, admin
     */
    public function index(Request $request, Workshop $workshop): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $workshop);
        $this->assertPlanAllowsTiers($workshop);

        $regCount = $this->getRegistrationCount($workshop->id);

        $tiers = WorkshopPriceTier::query()
            ->activeForWorkshop($workshop->id)
            ->get();

        $collection = $tiers->map(fn ($tier) => (new WorkshopPriceTierResource($tier))->withRegistrationCount($regCount));

        return response()->json(['data' => $collection->values()]);
    }

    /**
     * POST /api/v1/workshops/{workshop}/price-tiers
     * Allowed: owner, admin
     */
    public function store(StoreWorkshopPriceTierRequest $request, Workshop $workshop): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $workshop);
        $this->assertPlanAllowsTiers($workshop);

        $data = $request->validated();

        if (! isset($data['sort_order'])) {
            $data['sort_order'] = WorkshopPriceTier::where('workshop_id', $workshop->id)->max('sort_order') + 1;
        }

        $data['workshop_id']           = $workshop->id;
        $data['is_active']             = $data['is_active'] ?? true;
        $data['registrations_at_tier'] = 0;

        $tier = DB::transaction(function () use ($data) {
            return WorkshopPriceTier::create($data);
        });

        $this->tierSchedulingService->scheduleJobsForTier($tier);
        $this->priceResolutionService->bustCache($workshop->id);

        $regCount = $this->getRegistrationCount($workshop->id);

        return response()->json(
            ['data' => (new WorkshopPriceTierResource($tier))->withRegistrationCount($regCount)],
            201,
        );
    }

    /**
     * PATCH /api/v1/workshops/{workshop}/price-tiers/{tier}
     * Allowed: owner, admin
     */
    public function update(UpdateWorkshopPriceTierRequest $request, Workshop $workshop, WorkshopPriceTier $tier): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $workshop);
        $this->assertPlanAllowsTiers($workshop);
        $this->assertTierBelongsToWorkshop($tier, $workshop);

        $data = $request->validated();

        $schedulingFields = ['label', 'price_cents', 'valid_from', 'valid_until', 'capacity_limit'];
        $needsReschedule  = collect($schedulingFields)->some(fn ($f) => array_key_exists($f, $data));

        $tier->update($data);

        if ($needsReschedule) {
            $this->tierSchedulingService->scheduleJobsForTier($tier->fresh());
            $this->priceResolutionService->bustCache($workshop->id);
        }

        $regCount = $this->getRegistrationCount($workshop->id);

        return response()->json(
            ['data' => (new WorkshopPriceTierResource($tier->fresh()))->withRegistrationCount($regCount)],
        );
    }

    /**
     * DELETE /api/v1/workshops/{workshop}/price-tiers/{tier}
     * Soft-deactivates the tier.
     * Allowed: owner, admin
     */
    public function destroy(Request $request, Workshop $workshop, WorkshopPriceTier $tier): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $workshop);
        $this->assertPlanAllowsTiers($workshop);
        $this->assertTierBelongsToWorkshop($tier, $workshop);

        $regCount        = $this->getRegistrationCount($workshop->id);
        $wasCurrentlyActive = $tier->isEligible(now(), $regCount);

        $tier->update(['is_active' => false]);
        $this->tierSchedulingService->cancelJobsForTier($tier);
        $this->priceResolutionService->bustCache($workshop->id);

        if ($wasCurrentlyActive) {
            AuditLogService::record([
                'organization_id' => $workshop->organization_id,
                'actor_user_id'   => $request->user()->id,
                'entity_type'     => 'workshop_price_tier',
                'entity_id'       => $tier->id,
                'action'          => 'price_tier.deactivated_while_active',
                'metadata'        => [
                    'tier_label'   => $tier->label,
                    'price_cents'  => $tier->price_cents,
                    'workshop_id'  => $workshop->id,
                ],
            ]);
        }

        return response()->json(['message' => 'Tier deactivated.']);
    }

    /**
     * PUT /api/v1/workshops/{workshop}/price-tiers/order
     * Reorder tiers via drag-and-drop.
     * Allowed: owner, admin
     */
    public function reorder(UpdateTierOrderRequest $request, Workshop $workshop): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $workshop);
        $this->assertPlanAllowsTiers($workshop);

        $tiers = $request->input('tiers');

        // Validate all IDs belong to this workshop.
        $ids              = collect($tiers)->pluck('id');
        $validIds         = WorkshopPriceTier::where('workshop_id', $workshop->id)
            ->whereIn('id', $ids)
            ->pluck('id');

        if ($validIds->count() !== $ids->count()) {
            return response()->json(['error' => 'One or more tier IDs do not belong to this workshop.'], 422);
        }

        DB::transaction(function () use ($tiers) {
            foreach ($tiers as $entry) {
                WorkshopPriceTier::where('id', $entry['id'])
                    ->update(['sort_order' => $entry['sort_order']]);
            }
        });

        $this->priceResolutionService->bustCache($workshop->id);

        return response()->json(['message' => 'Sort order updated.']);
    }

    /**
     * GET /api/v1/workshops/{workshop}/price-tiers/current
     * Public-eligible — returns different payload for organizer vs public.
     */
    public function current(Request $request, Workshop $workshop): JsonResponse
    {
        $user       = $request->user();
        $isOrganizer = false;

        if ($user !== null) {
            $workshop->loadMissing('organization');
            $role        = $workshop->organization->memberRole($user);
            $isOrganizer = in_array($role, ['owner', 'admin', 'staff'], true);
        }

        if ($isOrganizer) {
            $resolution = $this->priceResolutionService->resolve($workshop, useCache: false);
            $regCount   = $this->getRegistrationCount($workshop->id);

            $tiers = WorkshopPriceTier::query()
                ->activeForWorkshop($workshop->id)
                ->get();

            return response()->json([
                'pricing_display'          => $this->priceResolutionService->buildPublicPricingDisplay($workshop),
                'current_resolution'       => [
                    'price_cents'       => $resolution->priceCents,
                    'currency'          => $resolution->currency,
                    'tier_id'           => $resolution->tierId,
                    'tier_label'        => $resolution->tierLabel,
                    'is_tier_price'     => $resolution->isTierPrice,
                    'remaining_capacity' => $resolution->remainingCapacity,
                    'base_price_cents'  => $resolution->basePriceCents,
                ],
                'registration_count'       => $regCount,
                'tiers'                    => $tiers->map(fn ($t) => (new WorkshopPriceTierResource($t))->withRegistrationCount($regCount)->toArray($request))->values(),
            ]);
        }

        return response()->json([
            'pricing' => $this->priceResolutionService->buildPublicPricingDisplay($workshop),
        ]);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function authorizeOwnerOrAdmin(Request $request, Workshop $workshop): void
    {
        // Allowed: owner, admin
        // Denied: staff, billing_admin
        $workshop->loadMissing('organization');
        $role = $workshop->organization->memberRole($request->user());

        if (! in_array($role, ['owner', 'admin'], true)) {
            abort(403, 'Only organization owners and admins may manage price tiers.');
        }
    }

    private function assertPlanAllowsTiers(Workshop $workshop): void
    {
        $workshop->loadMissing('organization');
        $planCode = $workshop->organization->activeSubscription?->plan_code ?? 'free';

        if (! in_array($planCode, self::TIER_PLANS, true)) {
            abort(402, 'Price tiers are available on Creator and Studio plans.');
        }
    }

    private function assertTierBelongsToWorkshop(WorkshopPriceTier $tier, Workshop $workshop): void
    {
        if ($tier->workshop_id !== $workshop->id) {
            abort(404);
        }
    }

    private function getRegistrationCount(int $workshopId): int
    {
        return (int) Registration::query()
            ->where('workshop_id', $workshopId)
            ->whereIn('registration_status', ['registered', 'waitlisted'])
            ->count();
    }
}

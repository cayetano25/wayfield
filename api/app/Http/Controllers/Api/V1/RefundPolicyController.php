<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Models\RefundPolicy;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreRefundPolicyRequest;
use App\Http\Resources\RefundPolicyResource;
use App\Models\Organization;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RefundPolicyController extends Controller
{
    // ─── Organization-scoped ─────────────────────────────────────────────────

    /**
     * GET /api/v1/organizations/{organization}/refund-policy
     * Allowed: owner, admin
     */
    public function showForOrganization(Request $request, Organization $organization): JsonResponse
    {
        $this->authorizeOwnerOrAdminForOrg($request, $organization);

        $policy = RefundPolicy::where('scope', 'organization')
            ->where('organization_id', $organization->id)
            ->first();

        if ($policy === null) {
            return response()->json(['data' => null], 200);
        }

        return response()->json(['data' => new RefundPolicyResource($policy)]);
    }

    /**
     * POST /api/v1/organizations/{organization}/refund-policy
     * Allowed: owner, admin
     */
    public function storeForOrganization(
        StoreRefundPolicyRequest $request,
        Organization $organization,
    ): JsonResponse {
        $this->authorizeOwnerOrAdminForOrg($request, $organization);

        $existing = RefundPolicy::where('scope', 'organization')
            ->where('organization_id', $organization->id)
            ->first();

        if ($existing !== null) {
            return response()->json([
                'error'   => 'policy_exists',
                'message' => 'A refund policy already exists for this organization. Use PUT to update.',
            ], 409);
        }

        $policy = RefundPolicy::create(array_merge(
            $request->validated(),
            [
                'scope'           => 'organization',
                'organization_id' => $organization->id,
                'workshop_id'     => null,
            ],
        ));

        return response()->json(['data' => new RefundPolicyResource($policy)], 201);
    }

    /**
     * PUT /api/v1/organizations/{organization}/refund-policy
     * Allowed: owner, admin
     */
    public function updateForOrganization(
        StoreRefundPolicyRequest $request,
        Organization $organization,
    ): JsonResponse {
        $this->authorizeOwnerOrAdminForOrg($request, $organization);

        $policy = RefundPolicy::where('scope', 'organization')
            ->where('organization_id', $organization->id)
            ->first();

        if ($policy === null) {
            return response()->json([
                'error'   => 'not_found',
                'message' => 'No refund policy found for this organization. Use POST to create.',
            ], 404);
        }

        $policy->update(array_merge(
            $request->validated(),
            ['scope' => 'organization'],
        ));

        return response()->json(['data' => new RefundPolicyResource($policy->fresh())]);
    }

    // ─── Workshop-scoped ─────────────────────────────────────────────────────

    /**
     * GET /api/v1/workshops/{workshop}/refund-policy
     * Allowed: owner, admin
     */
    public function showForWorkshop(Request $request, Workshop $workshop): JsonResponse
    {
        $this->authorizeOwnerOrAdminForWorkshop($request, $workshop);

        $policy = RefundPolicy::where('scope', 'workshop')
            ->where('workshop_id', $workshop->id)
            ->first();

        if ($policy === null) {
            return response()->json(['data' => null], 200);
        }

        return response()->json(['data' => new RefundPolicyResource($policy)]);
    }

    /**
     * POST /api/v1/workshops/{workshop}/refund-policy
     * Allowed: owner, admin
     */
    public function storeForWorkshop(
        StoreRefundPolicyRequest $request,
        Workshop $workshop,
    ): JsonResponse {
        $this->authorizeOwnerOrAdminForWorkshop($request, $workshop);

        $existing = RefundPolicy::where('scope', 'workshop')
            ->where('workshop_id', $workshop->id)
            ->first();

        if ($existing !== null) {
            return response()->json([
                'error'   => 'policy_exists',
                'message' => 'A refund policy already exists for this workshop. Use PUT to update.',
            ], 409);
        }

        $policy = RefundPolicy::create(array_merge(
            $request->validated(),
            [
                'scope'           => 'workshop',
                'organization_id' => $workshop->organization_id,
                'workshop_id'     => $workshop->id,
            ],
        ));

        return response()->json(['data' => new RefundPolicyResource($policy)], 201);
    }

    /**
     * PUT /api/v1/workshops/{workshop}/refund-policy
     * Allowed: owner, admin
     */
    public function updateForWorkshop(
        StoreRefundPolicyRequest $request,
        Workshop $workshop,
    ): JsonResponse {
        $this->authorizeOwnerOrAdminForWorkshop($request, $workshop);

        $policy = RefundPolicy::where('scope', 'workshop')
            ->where('workshop_id', $workshop->id)
            ->first();

        if ($policy === null) {
            return response()->json([
                'error'   => 'not_found',
                'message' => 'No refund policy found for this workshop. Use POST to create.',
            ], 404);
        }

        $policy->update(array_merge(
            $request->validated(),
            ['scope' => 'workshop'],
        ));

        return response()->json(['data' => new RefundPolicyResource($policy->fresh())]);
    }

    // ─────────────────────────────────────────────────────────────────────────

    private function authorizeOwnerOrAdminForOrg(Request $request, Organization $organization): void
    {
        // Allowed: owner, admin
        // Denied: staff, billing_admin
        $role = $organization->memberRole($request->user());

        if (! in_array($role, ['owner', 'admin'], true)) {
            abort(403, 'Only organization owners and admins may manage refund policies.');
        }
    }

    private function authorizeOwnerOrAdminForWorkshop(Request $request, Workshop $workshop): void
    {
        // Allowed: owner, admin
        // Denied: staff, billing_admin
        $workshop->loadMissing('organization');
        $role = $workshop->organization->memberRole($request->user());

        if (! in_array($role, ['owner', 'admin'], true)) {
            abort(403, 'Only organization owners and admins may manage refund policies.');
        }
    }
}
